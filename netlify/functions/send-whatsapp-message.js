const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para fetch com timeout
const fetchWithTimeout = async (url, options, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: requisicao excedeu ${timeoutMs}ms`);
    }
    throw error;
  }
};

/**
 * Envia mensagem WhatsApp via Webhook n8n
 * 
 * MULTI-TENANCY COM FALLBACK PARA CREDENCIAL GLOBAL:
 * 
 * 1. Se store_id for fornecido:
 *    a. Busca loja (id, name, whatsapp_ativo)
 *    b. Se whatsapp_ativo = false, NAO envia (skip)
 *    c. Encontra admin da loja via profiles (store_id = loja.id AND role = 'ADMIN')
 *    d. Usa email do admin como customer_id para buscar credenciais
 *    e. Se loja NAO tem credenciais conectadas, usa CREDENCIAL GLOBAL (is_global = true)
 *    f. Fallback final: variaveis de ambiente
 * 
 * 2. Se store_id NAO for fornecido:
 *    - Usa credencial global (is_global = true) do banco
 *    - Fallback final: variaveis de ambiente
 * 
 * 3. Em caso de ERRO de conexao Supabase:
 *    - Tenta usar variaveis de ambiente como fallback final
 * 
 * NOTA: A associacao loja->admin e feita via profiles.store_id (NAO via stores.admin_id)
 */
exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const { phone, message, store_id, use_global_whatsapp, whatsapp_account_id, campaign_id, message_type } = JSON.parse(event.body || '{}');

    if (!phone || !message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Telefone e mensagem sao obrigatorios',
          success: false,
        }),
      };
    }

    // ============================================================================
    // VALIDAÇÃO CRÍTICA: whatsapp_account_id só pode ser usado em CAMPANHAS
    // ============================================================================
    // Números reserva são EXCLUSIVOS para envio em massa (campanhas)
    // Mensagens normais (ponto, venda, ajuste, abertura/fechamento de caixa, cashback, notificações)
    // DEVEM usar números principais (whatsapp_credentials) ou global
    if (whatsapp_account_id && whatsapp_account_id !== 'null' && whatsapp_account_id !== '') {
      // Verificar se realmente é de uma campanha válida
      const isCampaignMessage = campaign_id && message_type === 'CAMPAIGN';
      
      if (!isCampaignMessage) {
        console.error('[WhatsApp] 🚨 BLOQUEADO: whatsapp_account_id fornecido mas NÃO é campanha!');
        console.error('[WhatsApp] 🚨 Detalhes:', {
          whatsapp_account_id,
          campaign_id,
          message_type,
          store_id,
          phone: phone.substring(0, 15) + '...'
        });
        console.error('[WhatsApp] 🚨 Mensagens normais DEVEM usar números principais. Ignorando whatsapp_account_id.');
        // IGNORAR whatsapp_account_id e continuar com lógica normal (números principais)
        // Não retornar erro, apenas ignorar o parâmetro incorreto
      }
    }

    const normalizePhone = (phoneNumber) => {
      if (!phoneNumber) return '';
      let cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
        return cleaned;
      }
      if (cleaned.startsWith('55') && cleaned.length > 13) {
        cleaned = cleaned.substring(2);
      }
      if (cleaned.length < 10 || cleaned.length > 11) {
        console.warn(`[normalizePhone] Telefone com tamanho invalido: ${cleaned.length} digitos`);
        if (cleaned.length < 10) {
          return cleaned;
        }
      }
      if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
      }
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const nonoDoFinal = cleaned[cleaned.length - 9];
        const decimoDoFinal = cleaned[cleaned.length - 10];
        if (nonoDoFinal === '9' && decimoDoFinal === '9') {
          const antes = cleaned.substring(0, cleaned.length - 9);
          const depois = cleaned.substring(cleaned.length - 8);
          cleaned = antes + depois;
          console.log(`[normalizePhone] Removido 9 extra: ${phoneNumber} -> ${cleaned}`);
        }
      }
      return cleaned;
    };

    const normalizedPhone = normalizePhone(phone);

    const generateSlug = (name) => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '')
        .replace(/_+/g, '_');
    };

    // ============================================================================
    // MULTI-TENANCY COM FALLBACK PARA CREDENCIAL GLOBAL
    // Suporte para números reserva via whatsapp_account_id
    // ============================================================================
    let siteSlug = null;
    let customerId = null;
    let credentialsSource = 'none';
    let shouldSend = true;
    let skipReason = null;
    let supabaseAvailable = true;
    let supabase = null;

    // Tentar conectar ao Supabase
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { db: { schema: 'sistemaretiradas' } }
        );
      } else {
        console.warn('[WhatsApp] Variaveis Supabase nao configuradas, usando fallback de env vars');
        supabaseAvailable = false;
      }
    } catch (err) {
      console.warn('[WhatsApp] Erro ao criar cliente Supabase:', err.message);
      supabaseAvailable = false;
    }

    // ============================================================================
    // FUNCAO HELPER: Buscar credencial de número reserva (whatsapp_accounts)
    // ============================================================================
    const fetchBackupAccountCredential = async (accountId) => {
      if (!supabase || !supabaseAvailable || !accountId) {
        return null;
      }

      console.log('[WhatsApp] Buscando credencial de número reserva:', accountId);
      
      try {
        // 1. Buscar número reserva em whatsapp_accounts
        const { data: backupAccount, error: backupError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_accounts')
          .select('id, phone, is_backup1, is_backup2, is_backup3, uazapi_token, uazapi_instance_id, uazapi_status, store_id, is_connected')
          .eq('id', accountId)
          .single();

        if (backupError) {
          console.warn('[WhatsApp] Erro ao buscar número reserva:', backupError.message);
          return null;
        }

        if (!backupAccount || !backupAccount.is_connected || backupAccount.uazapi_status !== 'connected') {
          console.log('[WhatsApp] Número reserva não encontrado ou não conectado (status:', backupAccount?.uazapi_status || 'não existe', ')');
          return null;
        }

        if (!backupAccount.uazapi_token || !backupAccount.uazapi_instance_id) {
          console.warn('[WhatsApp] Número reserva sem token ou instance_id');
          return null;
        }

        // 2. Buscar loja para obter site_slug
        const { data: store } = await supabase
          .schema('sistemaretiradas')
          .from('stores')
          .select('site_slug, name')
          .eq('id', backupAccount.store_id)
          .single();

        if (!store) {
          console.warn('[WhatsApp] Loja não encontrada para número reserva');
          return null;
        }

        // 3. Buscar credencial principal da loja para obter customer_id (email do admin)
        // Usar site_slug da loja para buscar em whatsapp_credentials
        const storeSlug = store.site_slug || generateSlug(store.name);
        const { data: primaryCredential } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_credentials')
          .select('customer_id, admin_id')
          .eq('site_slug', storeSlug)
          .eq('status', 'active')
          .eq('is_global', false)
          .maybeSingle();

        // Se não encontrar credencial principal, usar site_slug como customer_id (fallback)
        // O N8N pode aceitar site_slug como customer_id em alguns casos
        let customerId = primaryCredential?.customer_id || storeSlug;

        // Se temos admin_id, buscar email do profile
        if (primaryCredential?.admin_id && !primaryCredential?.customer_id) {
          const { data: adminProfile } = await supabase
            .schema('sistemaretiradas')
            .from('profiles')
            .select('email')
            .eq('id', primaryCredential.admin_id)
            .single();

          if (adminProfile?.email) {
            customerId = adminProfile.email;
          }
        }

        // Determinar tipo de backup e gerar siteSlug único com sufixo
        // Isso garante que números reserva tenham instâncias únicas no N8N/UazAPI
        let accountType = "BACKUP_1";
        let backupSuffix = '_backup1';
        if (backupAccount.is_backup2) {
          accountType = "BACKUP_2";
          backupSuffix = '_backup2';
        } else if (backupAccount.is_backup3) {
          accountType = "BACKUP_3";
          backupSuffix = '_backup3';
        }
        
        // SiteSlug único para número reserva (com sufixo para diferenciar do principal)
        const uniqueSiteSlug = storeSlug + backupSuffix;

        console.log('[WhatsApp] Número reserva encontrado e conectado:', backupAccount.phone);
        console.log('[WhatsApp] SiteSlug único para número reserva:', uniqueSiteSlug, '| Tipo:', accountType);
        
        return {
          siteSlug: uniqueSiteSlug, // Usar siteSlug único com sufixo
          customerId: customerId,
          token: backupAccount.uazapi_token,
          instanceId: backupAccount.uazapi_instance_id,
          phone: backupAccount.phone,
          source: `backup_account:${accountType}`,
          accountType: accountType
        };
      } catch (err) {
        console.warn('[WhatsApp] Erro ao buscar número reserva:', err.message);
        return null;
      }
    };

    // ============================================================================
    // FUNCAO HELPER: Buscar credencial global do banco
    // ============================================================================
    const fetchGlobalCredential = async () => {
      if (!supabase || !supabaseAvailable) {
        console.log('[WhatsApp] Supabase indisponivel, nao pode buscar credencial global');
        return null;
      }

      console.log('[WhatsApp] Buscando credencial global (is_global = true)...');
      
      try {
        const { data: globalCred, error: globalError } = await supabase
          .from('whatsapp_credentials')
          .select('customer_id, site_slug, uazapi_status, display_name')
          .eq('is_global', true)
          .eq('status', 'active')
          .maybeSingle();

        if (globalError) {
          console.warn('[WhatsApp] Erro ao buscar credencial global:', globalError.message);
          return null;
        }

        if (globalCred && globalCred.uazapi_status === 'connected') {
          console.log('[WhatsApp] Credencial global encontrada e conectada:', globalCred.display_name || 'Elevea Global');
          return {
            siteSlug: globalCred.site_slug,
            customerId: globalCred.customer_id,
            source: 'global_db'
          };
        }

        console.log('[WhatsApp] Credencial global nao encontrada ou nao conectada (status:', globalCred?.uazapi_status || 'nao existe', ')');
        return null;
      } catch (err) {
        console.warn('[WhatsApp] Erro ao buscar credencial global:', err.message);
        return null;
      }
    };

    // ============================================================================
    // LOGICA PRINCIPAL: Determinar credenciais a usar
    // ============================================================================
    const functionStart = Date.now();
    
    // PRIORIDADE 1: Se whatsapp_account_id fornecido (e não é null/undefined/vazio), buscar número reserva
    // IMPORTANTE: Só usar número reserva se for MENSAGEM DE CAMPANHA (message_type === 'CAMPAIGN' e campaign_id presente)
    const isValidCampaign = campaign_id && message_type === 'CAMPAIGN';
    const shouldUseBackup = whatsapp_account_id && whatsapp_account_id !== 'null' && whatsapp_account_id !== '' && isValidCampaign;
    
    if (shouldUseBackup && supabaseAvailable && supabase) {
      console.log('[WhatsApp] ✅ whatsapp_account_id fornecido para CAMPANHA, buscando número reserva...');
      console.log('[WhatsApp] Detalhes da campanha:', { campaign_id, message_type, whatsapp_account_id });
      const backupCred = await fetchBackupAccountCredential(whatsapp_account_id);
      if (backupCred) {
        siteSlug = backupCred.siteSlug;
        customerId = backupCred.customerId;
        credentialsSource = backupCred.source;
        console.log('[WhatsApp] ✅ Usando número reserva para campanha:', backupCred.phone, '| Tipo:', backupCred.accountType);
      } else {
        console.warn('[WhatsApp] ⚠️ Número reserva não encontrado ou não conectado, caindo para número principal');
        // Continuar para lógica normal abaixo - siteSlug e customerId ainda são null
      }
    } else if (whatsapp_account_id && whatsapp_account_id !== 'null' && whatsapp_account_id !== '') {
      // whatsapp_account_id fornecido mas NÃO é campanha - IGNORAR e usar números principais
      console.warn('[WhatsApp] ⚠️ whatsapp_account_id fornecido mas NÃO é campanha válida. Ignorando e usando números principais.');
      console.warn('[WhatsApp] ⚠️ Parâmetros recebidos:', { whatsapp_account_id, campaign_id, message_type });
    }
    
    // PRIORIDADE 2: Se não encontrou número reserva (ou não foi fornecido), buscar credencial normal
    if (!siteSlug || !customerId) {
      if (store_id && supabaseAvailable && supabase) {
        console.log('[WhatsApp] Buscando credenciais para store_id:', store_id);

        try {
          // 1. Buscar loja para obter nome, site_slug e status whatsapp_ativo
          // NOTA: NAO usamos admin_id da tabela stores (coluna nao existe)
          const queryStart = Date.now();
          const { data: store, error: storeError } = await supabase
            .from('stores')
            .select('id, name, whatsapp_ativo, site_slug')
            .eq('id', store_id)
            .single();
          console.log(`[WhatsApp] Query stores: ${Date.now() - queryStart}ms`);

          if (storeError) {
            console.warn('[WhatsApp] Erro ao buscar loja:', storeError.message);
            // FALLBACK: Erro ao buscar loja - tentar credencial global
            console.log('[WhatsApp] Tentando credencial global como fallback...');
            const globalCred = await fetchGlobalCredential();
            if (globalCred) {
              siteSlug = globalCred.siteSlug;
              customerId = globalCred.customerId;
              credentialsSource = 'global_db (fallback erro loja)';
            }
          } else if (!store) {
            console.log('[WhatsApp] Loja nao encontrada, tentando credencial global...');
            const globalCred = await fetchGlobalCredential();
            if (globalCred) {
              siteSlug = globalCred.siteSlug;
              customerId = globalCred.customerId;
              credentialsSource = 'global_db (loja nao encontrada)';
            }
          } else if (store.whatsapp_ativo === false) {
            // Loja existe mas WhatsApp esta EXPLICITAMENTE desativado - NAO envia
            console.log('[WhatsApp] Loja', store.name, 'tem whatsapp_ativo = false. NAO enviando.');
            shouldSend = false;
            skipReason = 'whatsapp_desativado';
          } else {
            // Loja existe e tem WhatsApp ATIVO (ou nao definido = ativo por padrao)
            console.log('[WhatsApp] Loja', store.name, '- WhatsApp ativo. Buscando credenciais...');
            
            // Se use_global_whatsapp = true, usar global diretamente sem verificar credenciais da loja
            if (use_global_whatsapp === true) {
              console.log('[WhatsApp] use_global_whatsapp=true, usando credencial GLOBAL diretamente');
              const globalCred = await fetchGlobalCredential();
              if (globalCred) {
                siteSlug = globalCred.siteSlug;
                customerId = globalCred.customerId;
                credentialsSource = `global_db (escolhido pelo usuario)`;
              }
            } else {
              // Buscar credenciais da loja DIRETAMENTE pelo site_slug
              // IMPORTANTE: Usar site_slug da tabela stores se existir, caso contrario gerar
              const storeSlug = store.site_slug || generateSlug(store.name);
              console.log('[WhatsApp] Usando slug:', storeSlug, '(fonte:', store.site_slug ? 'site_slug' : 'generateSlug', ')');
              let storeHasOwnCredentials = false;

              // 2. Buscar credenciais PROPRIAS da loja diretamente pelo site_slug (mais confiavel)
              const credStart = Date.now();
              const { data: storeCreds, error: credError } = await supabase
                .from('whatsapp_credentials')
                .select('customer_id, site_slug, uazapi_status, is_global, admin_id')
                .eq('site_slug', storeSlug)
                .eq('status', 'active')
                .eq('is_global', false)
                .maybeSingle();
              console.log(`[WhatsApp] Query credenciais: ${Date.now() - credStart}ms`);

              console.log('[WhatsApp] Busca credenciais por site_slug:', storeSlug, '| resultado:', storeCreds ? 'encontrado' : 'nao encontrado');

              // Verificar se esta conectada
              if (!credError && storeCreds && storeCreds.uazapi_status === 'connected') {
                siteSlug = storeCreds.site_slug;
                customerId = storeCreds.customer_id || storeSlug;
                credentialsSource = `loja:${store.name}`;
                storeHasOwnCredentials = true;
                console.log('[WhatsApp] Usando credenciais PROPRIAS da loja:', store.name, '| status:', storeCreds.uazapi_status);
              } else {
                console.log('[WhatsApp] Loja sem credenciais proprias conectadas (status:', storeCreds?.uazapi_status || 'nao encontrado', ')');
              }

              // 3. Se loja NAO tem credenciais proprias, usar GLOBAL como fallback
              if (!storeHasOwnCredentials) {
                console.log('[WhatsApp] Loja', store.name, 'vai usar credencial GLOBAL (fallback)');
                const globalCred = await fetchGlobalCredential();
                if (globalCred) {
                  siteSlug = globalCred.siteSlug;
                  customerId = globalCred.customerId;
                  credentialsSource = `global_db (loja: ${store.name})`;
                }
              }
            }
          }
        } catch (err) {
          console.warn('[WhatsApp] Erro ao processar store_id:', err.message);
          // FALLBACK: Erro geral - tentar credencial global
          console.log('[WhatsApp] Tentando credencial global como fallback apos erro...');
          const globalCred = await fetchGlobalCredential();
          if (globalCred) {
            siteSlug = globalCred.siteSlug;
            customerId = globalCred.customerId;
            credentialsSource = 'global_db (fallback erro)';
          }
        }
      } else if (!store_id && supabaseAvailable && supabase) {
        // Sem store_id - usar credencial global
        console.log('[WhatsApp] Sem store_id, usando credencial global');
        const globalCred = await fetchGlobalCredential();
        if (globalCred) {
          siteSlug = globalCred.siteSlug;
          customerId = globalCred.customerId;
          credentialsSource = globalCred.source;
        }
      } else if (!supabaseAvailable) {
        console.log('[WhatsApp] Supabase indisponivel, pulando busca de credenciais');
      }
    }

    // ============================================================================
    // FALLBACK FINAL: Variaveis de ambiente
    // ============================================================================
    if (shouldSend && (!customerId || !siteSlug)) {
      console.log('[WhatsApp] Credenciais nao encontradas no banco, usando variaveis de ambiente');
      
      if (process.env.WHATSAPP_SITE_SLUG && process.env.N8N_CUSTOMER_ID) {
        siteSlug = process.env.WHATSAPP_SITE_SLUG;
        customerId = process.env.N8N_CUSTOMER_ID;
        credentialsSource = 'env_vars';
        console.log('[WhatsApp] Usando credenciais de variaveis de ambiente');
      } else {
        console.error('[WhatsApp] Nenhuma credencial disponivel (banco ou env vars)');
      }
    }

    // ============================================================================
    // VERIFICAR SE DEVE ENVIAR
    // ============================================================================
    if (!shouldSend) {
      console.log('[WhatsApp] Envio cancelado. Motivo:', skipReason);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          success: true,
          skipped: true,
          skip_reason: skipReason,
          message: 'Envio ignorado - WhatsApp desativado para esta loja',
          credentials_source: 'none',
        }),
      };
    }

    // Validar que temos customerId
    if (!customerId || !siteSlug) {
      console.error('[WhatsApp] Nenhum customerId ou siteSlug disponivel');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Credenciais WhatsApp nao configuradas. Configure a credencial global no painel DEV ou as variaveis de ambiente.',
          success: false,
        }),
      };
    }

    const prepTime = Date.now() - functionStart;
    console.log(`[WhatsApp] Tempo de preparacao: ${prepTime}ms`);
    console.log(`[WhatsApp] Enviando para: ${normalizedPhone}`);
    console.log(`[WhatsApp] Fonte das credenciais: ${credentialsSource}`);
    console.log(`[WhatsApp] siteSlug: ${siteSlug}, customerId: ${customerId}`);

    // Preparar payload - Webhook N8N para envio de mensagens
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send';
    const webhookAuth = process.env.N8N_WEBHOOK_AUTH;

    const messageEscaped = JSON.stringify(message);
    const messageSafe = messageEscaped.slice(1, -1);

    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phone_number: String(normalizedPhone),
      message: messageSafe,
    };

    console.log('[WhatsApp] Payload:', JSON.stringify(payload));

    const headers = {
      'Content-Type': 'application/json',
    };

    if (webhookAuth) {
      headers['x-app-key'] = webhookAuth;
    }

    const startTime = Date.now();
    console.log('[WhatsApp] Enviando para webhook N8N...');
    
    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    }, 15000); // 15 segundos de timeout (aumentado para evitar timeouts intermitentes)

    const elapsed = Date.now() - startTime;
    console.log(`[WhatsApp] Status: ${response.status} ${response.statusText} (${elapsed}ms)`);

    let responseData;
    const responseText = await response.text();

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText, raw: responseText };
    }

    if (!response.ok) {
      console.error('[WhatsApp] Erro:', responseData);
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`);
    }

    console.log('[WhatsApp] Mensagem enviada com sucesso');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Mensagem enviada com sucesso',
        credentials_source: credentialsSource,
        data: responseData,
      }),
    };
  } catch (error) {
    console.error('[WhatsApp] Erro:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        error: error.message || String(error),
        success: false,
      }),
    };
  }
};
