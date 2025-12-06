const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Autenticação WhatsApp via Webhook n8n
 * 
 * Esta função inicia o processo de autenticação do WhatsApp via n8n:
 * 1. Busca ou cria credenciais na tabela whatsapp_credentials
 * 2. Chama o webhook n8n para iniciar a conexão
 * 3. Retorna o QR code para exibição
 * 
 * MULTI-TENANCY:
 * - Usa customer_id (email do admin) e site_slug (nome da loja)
 * - Salva credenciais na tabela whatsapp_credentials
 * 
 * Variáveis de ambiente necessárias:
 * - SUPABASE_URL: URL do Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role Key
 * - WHATSAPP_AUTH_WEBHOOK_URL: URL do webhook n8n para autenticação
 * - N8N_WEBHOOK_AUTH: Token de autenticação do webhook
 */
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const { customer_id, site_slug, store_id } = JSON.parse(event.body || '{}');

    if (!customer_id || !site_slug) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'customer_id e site_slug são obrigatórios',
          success: false,
        }),
      };
    }

    console.log('[WhatsApp Auth] Iniciando autenticação:', { customer_id, site_slug, store_id });

    // Conectar ao Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { db: { schema: 'sistemaretiradas' } }
    );

    // Buscar admin token da tabela uazapi_config
    const { data: configData, error: configError } = await supabase
      .from('uazapi_config')
      .select('config_value')
      .eq('config_key', 'admin_token')
      .maybeSingle();

    if (configError) {
      console.error('[WhatsApp Auth] Erro ao buscar admin token:', configError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Erro ao buscar configuração: ' + configError.message,
          success: false,
        }),
      };
    }

    if (!configData || !configData.config_value) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Admin token não configurado. Configure o admin_token na tabela uazapi_config.',
          success: false,
        }),
      };
    }

    const uazapiAdminToken = configData.config_value;

    // Buscar credenciais existentes
    const { data: existingCredentials, error: fetchError } = await supabase
      .from('whatsapp_credentials')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('site_slug', site_slug)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[WhatsApp Auth] Erro ao buscar credenciais:', fetchError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Erro ao buscar credenciais: ' + fetchError.message,
          success: false,
        }),
      };
    }

    // Buscar URL do webhook da tabela app_config ou usar variável de ambiente
    let webhookUrl = process.env.WHATSAPP_AUTH_WEBHOOK_URL;
    let webhookAuth = process.env.N8N_WEBHOOK_AUTH;

    // Tentar buscar da tabela app_config se não estiver nas variáveis de ambiente
    if (!webhookUrl) {
      const { data: configData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'whatsapp_auth_webhook_url')
        .maybeSingle();
      
      if (configData && configData.value) {
        webhookUrl = configData.value;
      } else {
        webhookUrl = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect';
      }
    }

    if (!webhookAuth) {
      const { data: authData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'n8n_webhook_auth')
        .maybeSingle();
      
      if (authData && authData.value) {
        webhookAuth = authData.value;
      }
    }

    // Enviar payload em camelCase para compatibilidade com workflow n8n
    const payload = {
      customerId: customer_id,
      siteSlug: site_slug,
      uazapiToken: uazapiAdminToken,
    };

    console.log('[WhatsApp Auth] Chamando webhook n8n:', webhookUrl);
    console.log('[WhatsApp Auth] Payload:', JSON.stringify({ ...payload, uazapi_admin_token: '***' }));

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

    console.log('[WhatsApp Auth] Status da resposta:', response.status, response.statusText);

    let responseData;
    const responseText = await response.text();

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText, raw: responseText };
    }

    if (!response.ok) {
      console.error('[WhatsApp Auth] ❌ Erro:', responseData);
      return {
        statusCode: response.status || 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: responseData.message || responseData.error || `HTTP ${response.status}`,
          success: false,
          data: responseData,
        }),
      };
    }

    console.log('[WhatsApp Auth] ✅ Resposta do n8n:', JSON.stringify(responseData, null, 2));

    // A resposta do n8n pode vir como array ou objeto
    // Estrutura 1: Array do Respond final (dados já processados)
    // Estrutura 2: Objeto direto do HTTP Request (com instance dentro)
    let processedData = responseData;
    if (Array.isArray(responseData) && responseData.length > 0) {
      processedData = responseData[0];
      console.log('[WhatsApp Auth] Resposta é array, usando primeiro elemento');
      
      // Se o array contém dados já processados (com uazapi_qr_code direto)
      if (processedData.uazapi_qr_code) {
        console.log('[WhatsApp Auth] Estrutura: Array com dados já processados');
        // Já temos tudo diretamente no processedData
      } else if (processedData.instance) {
        console.log('[WhatsApp Auth] Estrutura: Array com instance dentro');
        // Dados dentro de instance
      }
    }

    // Tentar extrair QR Code de diferentes possíveis estruturas
    // Estrutura 1 (Respond final): [{ uazapi_qr_code: "...", uazapi_status: "..." }]
    // Estrutura 2 (HTTP Request): [{ instance: { qrcode: "...", status: "...", id: "..." } }]
    const qrCode = processedData.uazapi_qr_code ||  // Estrutura do Respond final
                   processedData.instance?.qrcode || // Estrutura do HTTP Request
                   processedData.qr_code || 
                   processedData.qrcode || 
                   processedData.qrCode ||
                   processedData.data?.qr_code ||
                   processedData.data?.qrcode ||
                   processedData.data?.instance?.qrcode ||
                   processedData.body?.qr_code ||
                   processedData.body?.qrcode ||
                   processedData.body?.instance?.qrcode ||
                   null;

    const status = processedData.uazapi_status ||  // Estrutura do Respond final
                   processedData.instance?.status || // Estrutura do HTTP Request
                   processedData.status || 
                   processedData.data?.status ||
                   processedData.data?.instance?.status ||
                   processedData.body?.status ||
                   processedData.body?.instance?.status ||
                   'connecting';

    const instanceId = processedData.uazapi_instance_id ||  // Estrutura do Respond final
                      processedData.instance?.id ||  // Estrutura do HTTP Request
                      processedData.instance_id || 
                      processedData.instanceId ||
                      processedData.data?.instance_id ||
                      processedData.data?.instance?.id ||
                      processedData.body?.instance_id ||
                      processedData.body?.instance?.id ||
                      null;

    const token = processedData.uazapi_token ||  // Estrutura do Respond final
                  processedData.instance?.token ||  // Estrutura do HTTP Request
                  processedData.token || 
                  processedData.data?.token ||
                  processedData.data?.instance?.token ||
                  processedData.body?.token ||
                  processedData.body?.instance?.token ||
                  null;

    const phoneNumber = processedData.uazapi_phone_number ||  // Estrutura do Respond final
                       processedData.instance?.profileName ||  // Estrutura do HTTP Request
                       processedData.phone_number || 
                       processedData.phoneNumber ||
                       processedData.data?.phone_number ||
                       processedData.body?.phone_number ||
                       null;

    console.log('[WhatsApp Auth] QR Code extraído:', qrCode ? 'SIM (' + (qrCode.substring(0, 50) + '...') + ')' : 'NÃO');
    console.log('[WhatsApp Auth] Status extraído:', status);
    console.log('[WhatsApp Auth] Instance ID extraído:', instanceId);
    console.log('[WhatsApp Auth] Token extraído:', token ? 'SIM' : 'NÃO');
    console.log('[WhatsApp Auth] Phone Number extraído:', phoneNumber || 'NÃO');

    // Extrair outros campos necessários
    const instanceName = processedData.whatsapp_instance_name ||
                        processedData.instance?.name ||
                        processedData.instance_name ||
                        processedData.instanceName ||
                        existingCredentials?.whatsapp_instance_name ||
                        null;

    const chatwootBaseUrl = processedData.chatwoot_base_url ||
                           existingCredentials?.chatwoot_base_url ||
                           null;

    const chatwootAccountId = processedData.chatwoot_account_id ||
                             existingCredentials?.chatwoot_account_id ||
                             null;

    const chatwootAccessToken = processedData.chatwoot_access_token ||
                               existingCredentials?.chatwoot_access_token ||
                               null;

    const chatwootInboxId = processedData.chatwoot_inbox_id ||
                           existingCredentials?.chatwoot_inbox_id ||
                           null;

    // Salvar/atualizar credenciais no banco
    const credentialsData = {
      customer_id: customer_id,
      site_slug: site_slug,
      uazapi_instance_id: instanceId || existingCredentials?.uazapi_instance_id || null,
      uazapi_token: token || existingCredentials?.uazapi_token || null,
      uazapi_phone_number: phoneNumber || existingCredentials?.uazapi_phone_number || null,
      uazapi_qr_code: qrCode || existingCredentials?.uazapi_qr_code || null,
      uazapi_status: status || 'connecting',
      whatsapp_instance_name: instanceName,
      chatwoot_base_url: chatwootBaseUrl,
      chatwoot_account_id: chatwootAccountId,
      chatwoot_access_token: chatwootAccessToken,
      chatwoot_inbox_id: chatwootInboxId,
      status: 'active',
      instance_metadata: processedData.instance_metadata || processedData.instance || existingCredentials?.instance_metadata || null,
    };

    const { error: upsertError } = await supabase
      .from('whatsapp_credentials')
      .upsert(credentialsData, {
        onConflict: 'customer_id,site_slug',
      });

    if (upsertError) {
      console.error('[WhatsApp Auth] Erro ao salvar credenciais:', upsertError);
      // Não falhar a requisição se o upsert falhar, apenas logar
    }

    // Se houver store_id, atualizar também a tabela stores
    if (store_id && token) {
      await supabase
        .from('stores')
        .update({
          uazapi_token: token,
          uazapi_instance_id: instanceId,
          whatsapp_connection_status: status || 'connecting',
        })
        .eq('id', store_id);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Autenticação iniciada com sucesso',
        qr_code: qrCode, // Usar QR Code extraído
        status: status, // Usar status extraído
        instance_id: instanceId, // Usar instance ID extraído
        phone_number: phoneNumber, // Usar phone number extraído
        data: responseData, // Manter resposta completa para debug
      }),
    };
  } catch (error) {
    console.error('[WhatsApp Auth] ❌ Erro:', error);
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

