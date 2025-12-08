const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Envia mensagem WhatsApp via Webhook n8n
 * 
 * MULTI-TENANCY COM FALLBACK PARA CREDENCIAL GLOBAL:
 * 
 * 1. Se store_id for fornecido:
 *    a. Verifica se loja tem whatsapp_ativo = true
 *    b. Se whatsapp_ativo = false, NAO envia (skip)
 *    c. Se whatsapp_ativo = true, busca credenciais proprias da loja (status = connected)
 *    d. Se loja NAO tem credenciais conectadas, usa CREDENCIAL GLOBAL (is_global = true)
 *    e. Se nao encontrar credencial global, usa variaveis de ambiente
 * 
 * 2. Se store_id NAO for fornecido:
 *    - Usa credencial global (is_global = true) do banco
 *    - Fallback final: variaveis de ambiente
 * 
 * 3. Em caso de ERRO de conexao Supabase:
 *    - Tenta usar variaveis de ambiente como fallback final
 * 
 * Variaveis de ambiente (fallback):
 * - SUPABASE_URL: URL do Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role Key para buscar credenciais
 * - WHATSAPP_WEBHOOK_URL: URL do webhook n8n
 * - N8N_WEBHOOK_AUTH: Token de autenticacao do webhook
 * - WHATSAPP_SITE_SLUG: Site slug global de fallback (ultimo recurso)
 * - N8N_CUSTOMER_ID: Customer ID global de fallback (ultimo recurso)
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
    const { phone, message, store_id } = JSON.parse(event.body || '{}');

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
    if (store_id && supabaseAvailable && supabase) {
      console.log('[WhatsApp] Buscando credenciais para store_id:', store_id);

      try {
        // 1. Buscar loja para obter nome, admin_id e status whatsapp_ativo
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('name, admin_id, whatsapp_ativo')
          .eq('id', store_id)
          .single();

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
          // Se nao encontrar global, vai cair no fallback de env vars
        } else if (!store) {
          console.log('[WhatsApp] Loja nao encontrada, tentando credencial global...');
          // FALLBACK: Loja nao encontrada - tentar credencial global
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
          
          const storeSlug = generateSlug(store.name);
          let storeHasOwnCredentials = false;

          // 2. Buscar email do admin para usar como customerId
          if (store.admin_id) {
            const { data: adminProfile, error: adminError } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', store.admin_id)
              .single();

            if (!adminError && adminProfile && adminProfile.email) {
              const adminEmail = adminProfile.email;
              console.log('[WhatsApp] Admin email:', adminEmail);

              // 3. Buscar credenciais PROPRIAS da loja (nao global)
              const { data: storeCreds, error: credError } = await supabase
                .from('whatsapp_credentials')
                .select('customer_id, site_slug, uazapi_status')
                .eq('customer_id', adminEmail)
                .eq('site_slug', storeSlug)
                .eq('status', 'active')
                .maybeSingle();

              // Verificar se nao e a credencial global
              if (!credError && storeCreds && storeCreds.uazapi_status === 'connected') {
                // Loja tem credenciais proprias e conectadas
                siteSlug = storeCreds.site_slug;
                customerId = storeCreds.customer_id;
                credentialsSource = `loja:${store.name}`;
                storeHasOwnCredentials = true;
                console.log('[WhatsApp] Usando credenciais PROPRIAS da loja:', store.name);
              } else {
                console.log('[WhatsApp] Loja sem credenciais proprias conectadas (status:', storeCreds?.uazapi_status || 'nao encontrado', ')');
              }
            } else {
              console.log('[WhatsApp] Erro ao buscar admin ou admin sem email');
            }
          }

          // 4. Se loja NAO tem credenciais proprias, usar GLOBAL
          if (!storeHasOwnCredentials) {
            console.log('[WhatsApp] Loja', store.name, 'vai usar credencial GLOBAL');
            const globalCred = await fetchGlobalCredential();
            if (globalCred) {
              siteSlug = globalCred.siteSlug;
              customerId = globalCred.customerId;
              credentialsSource = `global_db (loja: ${store.name})`;
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

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    console.log('[WhatsApp] Status:', response.status, response.statusText);

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
