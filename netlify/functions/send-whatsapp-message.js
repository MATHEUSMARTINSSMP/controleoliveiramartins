const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Envia mensagem WhatsApp via Webhook n8n
 * 
 * MULTI-TENANCY:
 * - Se store_id for fornecido e a loja tiver credenciais, usa as da loja
 * - Caso contrário, usa as credenciais globais (variáveis de ambiente)
 * 
 * Variáveis de ambiente necessárias:
 * - SUPABASE_URL: URL do Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role Key para buscar credenciais
 * - WHATSAPP_WEBHOOK_URL: URL do webhook n8n
 * - N8N_WEBHOOK_AUTH: Token de autenticação do webhook
 * - UAZAPI_TOKEN: Token global de fallback
 * - UAZAPI_INSTANCE_ID: Instance ID global de fallback
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
    const { phone, message, store_id } = JSON.parse(event.body || '{}');

    if (!phone || !message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Telefone e mensagem são obrigatórios',
          success: false,
        }),
      };
    }

    // Normalizar telefone para WhatsApp (DDI + DDD + número)
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
        console.warn(`[normalizePhone] ⚠️ Telefone com tamanho inválido: ${cleaned.length} dígitos`);
        if (cleaned.length < 10) {
          return cleaned;
        }
      }

      if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
      }

      // Verificar 9 duplicado
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const nonoDoFinal = cleaned[cleaned.length - 9];
        const decimoDoFinal = cleaned[cleaned.length - 10];

        if (nonoDoFinal === '9' && decimoDoFinal === '9') {
          const antes = cleaned.substring(0, cleaned.length - 9);
          const depois = cleaned.substring(cleaned.length - 8);
          cleaned = antes + depois;
          console.log(`[normalizePhone] 🔧 Removido 9 extra: ${phoneNumber} -> ${cleaned}`);
        }
      }

      return cleaned;
    };

    const normalizedPhone = normalizePhone(phone);

    // ============================================================================
    // MULTI-TENANCY: Buscar credenciais da loja ou usar globais
    // ============================================================================
    let uazapiToken = process.env.UAZAPI_TOKEN;
    let uazapiInstanceId = process.env.UAZAPI_INSTANCE_ID;
    let credentialsSource = 'global';

    if (store_id) {
      console.log('[WhatsApp] 🔍 Buscando credenciais da loja:', store_id);

      try {
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          { db: { schema: 'sistemaretiradas' } }
        );

        const { data: store, error } = await supabase
          .from('stores')
          .select('uazapi_token, uazapi_instance_id, whatsapp_ativo, name')
          .eq('id', store_id)
          .single();

        if (error) {
          console.warn('[WhatsApp] ⚠️ Erro ao buscar loja:', error.message);
        } else if (store && store.whatsapp_ativo && store.uazapi_token) {
          // Loja tem WhatsApp configurado - usar credenciais da loja
          uazapiToken = store.uazapi_token;
          uazapiInstanceId = store.uazapi_instance_id || uazapiInstanceId;
          credentialsSource = `loja:${store.name}`;
          console.log(`[WhatsApp] ✅ Usando credenciais da loja: ${store.name}`);
        } else {
          console.log('[WhatsApp] ℹ️ Loja sem WhatsApp configurado, usando credenciais globais');
        }
      } catch (err) {
        console.warn('[WhatsApp] ⚠️ Erro ao conectar Supabase:', err.message);
        console.log('[WhatsApp] ℹ️ Usando credenciais globais como fallback');
      }
    } else {
      console.log('[WhatsApp] ℹ️ store_id não fornecido, usando credenciais globais');
    }

    // Validar tokens
    if (!uazapiToken) {
      console.error('[WhatsApp] ❌ Nenhum token UAZAPI disponível');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Token UAZAPI não configurado',
          success: false,
        }),
      };
    }

    console.log(`[WhatsApp] 📱 Enviando para: ${normalizedPhone}`);
    console.log(`[WhatsApp] 📱 Fonte das credenciais: ${credentialsSource}`);

    // Buscar configurações da tabela app_config ou usar variáveis de ambiente
    let webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    let webhookAuth = process.env.N8N_WEBHOOK_AUTH;
    const siteSlug = process.env.WHATSAPP_SITE_SLUG || 'elevea';
    const customerId = process.env.N8N_CUSTOMER_ID;

    // Tentar buscar da tabela app_config se não estiver nas variáveis de ambiente
    if (!webhookUrl) {
      const { data: configData } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'whatsapp_send_webhook_url')
        .maybeSingle();
      
      if (configData && configData.value) {
        webhookUrl = configData.value;
      } else {
        webhookUrl = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send';
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

    const messageEscaped = JSON.stringify(message);
    const messageSafe = messageEscaped.slice(1, -1);

    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phone_number: String(normalizedPhone),
      message: messageSafe,
      uazapi_token: uazapiToken,
    };

    if (uazapiInstanceId) {
      payload.uazapi_instance_id = uazapiInstanceId;
    }

    console.log('[WhatsApp] 📦 Payload:', JSON.stringify({ ...payload, uazapi_token: '***' }));

    const headers = {
      'Content-Type': 'application/json',
      'x-app-key': webhookAuth,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    console.log('[WhatsApp] 📥 Status:', response.status, response.statusText);

    let responseData;
    const responseText = await response.text();

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText, raw: responseText };
    }

    if (!response.ok) {
      console.error('[WhatsApp] ❌ Erro:', responseData);
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`);
    }

    console.log('[WhatsApp] ✅ Mensagem enviada com sucesso');

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
    console.error('[WhatsApp] ❌ Erro:', error);
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
