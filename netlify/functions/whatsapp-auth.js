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

    // Preparar payload para n8n
    const webhookUrl = process.env.WHATSAPP_AUTH_WEBHOOK_URL || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth';
    const webhookAuth = process.env.N8N_WEBHOOK_AUTH;

    const payload = {
      customer_id: customer_id,
      site_slug: site_slug,
      uazapi_admin_token: uazapiAdminToken,
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

    console.log('[WhatsApp Auth] ✅ Resposta do n8n:', responseData);

    // Salvar/atualizar credenciais no banco
    const credentialsData = {
      customer_id: customer_id,
      site_slug: site_slug,
      uazapi_instance_id: responseData.instance_id || existingCredentials?.uazapi_instance_id || null,
      uazapi_token: responseData.token || existingCredentials?.uazapi_token || null,
      uazapi_phone_number: responseData.phone_number || existingCredentials?.uazapi_phone_number || null,
      uazapi_qr_code: responseData.qr_code || existingCredentials?.uazapi_qr_code || null,
      uazapi_status: responseData.status || 'connecting',
      whatsapp_instance_name: responseData.instance_name || existingCredentials?.whatsapp_instance_name || null,
      chatwoot_base_url: responseData.chatwoot_base_url || existingCredentials?.chatwoot_base_url || null,
      chatwoot_account_id: responseData.chatwoot_account_id || existingCredentials?.chatwoot_account_id || null,
      chatwoot_access_token: responseData.chatwoot_access_token || existingCredentials?.chatwoot_access_token || null,
      chatwoot_inbox_id: responseData.chatwoot_inbox_id || existingCredentials?.chatwoot_inbox_id || null,
      status: 'active',
      instance_metadata: responseData.metadata || existingCredentials?.instance_metadata || null,
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
    if (store_id && responseData.token) {
      await supabase
        .from('stores')
        .update({
          uazapi_token: responseData.token,
          uazapi_instance_id: responseData.instance_id,
          whatsapp_connection_status: responseData.status || 'connecting',
        })
        .eq('id', store_id);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Autenticação iniciada com sucesso',
        qr_code: responseData.qr_code,
        status: responseData.status || 'connecting',
        instance_id: responseData.instance_id,
        phone_number: responseData.phone_number,
        data: responseData,
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

