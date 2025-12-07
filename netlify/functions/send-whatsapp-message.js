const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Envia mensagem WhatsApp via Webhook n8n
 * 
 * MULTI-TENANCY:
 * 1. Se store_id for fornecido:
 *    - Busca loja para obter slug e admin_id
 *    - Busca credenciais em whatsapp_credentials usando slug e admin email
 *    - Usa siteSlug e customerId da loja especifica
 * 2. Caso contrario:
 *    - Usa as credenciais globais (variaveis de ambiente)
 * 
 * Variaveis de ambiente necessarias:
 * - SUPABASE_URL: URL do Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role Key para buscar credenciais
 * - WHATSAPP_WEBHOOK_URL: URL do webhook n8n
 * - N8N_WEBHOOK_AUTH: Token de autenticacao do webhook
 * - WHATSAPP_SITE_SLUG: Site slug global de fallback
 * - N8N_CUSTOMER_ID: Customer ID global de fallback
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

    // Gerar slug a partir do nome da loja
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
    // MULTI-TENANCY: Buscar credenciais da loja ou usar globais
    // ============================================================================
    let siteSlug = process.env.WHATSAPP_SITE_SLUG || 'elevea';
    let customerId = process.env.N8N_CUSTOMER_ID;
    let credentialsSource = 'global';
    let storeWhatsAppActive = false;

    if (store_id) {
      console.log('[WhatsApp] Buscando credenciais da loja:', store_id);

      try {
        const supabase = createClient(
          process.env.SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          { db: { schema: 'sistemaretiradas' } }
        );

        // 1. Buscar loja para obter nome (para gerar slug), admin_id e status whatsapp_ativo
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('name, admin_id, whatsapp_ativo')
          .eq('id', store_id)
          .single();

        if (storeError) {
          console.warn('[WhatsApp] Erro ao buscar loja:', storeError.message);
        } else if (store && store.whatsapp_ativo) {
          storeWhatsAppActive = true;
          const storeSlug = generateSlug(store.name);
          console.log('[WhatsApp] Loja encontrada:', store.name, '| Slug:', storeSlug);

          // 2. Buscar email do admin para usar como customerId
          const { data: adminProfile, error: adminError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', store.admin_id)
            .single();

          if (adminError) {
            console.warn('[WhatsApp] Erro ao buscar admin:', adminError.message);
          } else if (adminProfile && adminProfile.email) {
            const adminEmail = adminProfile.email;
            console.log('[WhatsApp] Admin email:', adminEmail);

            // 3. Buscar credenciais WhatsApp da loja em whatsapp_credentials
            const { data: credentials, error: credError } = await supabase
              .from('whatsapp_credentials')
              .select('uazapi_token, uazapi_instance_id, uazapi_status, site_slug')
              .eq('customer_id', adminEmail)
              .eq('site_slug', storeSlug)
              .eq('status', 'active')
              .maybeSingle();

            if (credError) {
              console.warn('[WhatsApp] Erro ao buscar credenciais:', credError.message);
            } else if (credentials && credentials.uazapi_status === 'connected') {
              // Loja tem WhatsApp configurado e conectado
              siteSlug = storeSlug;
              customerId = adminEmail;
              credentialsSource = `loja:${store.name}`;
              console.log(`[WhatsApp] Usando credenciais da loja: ${store.name}`);
              console.log(`[WhatsApp] siteSlug: ${siteSlug}, customerId: ${customerId}`);
            } else {
              console.log('[WhatsApp] Loja sem WhatsApp conectado (status:', credentials?.uazapi_status || 'nao encontrado', ')');
              console.log('[WhatsApp] Usando credenciais globais');
            }
          }
        } else {
          console.log('[WhatsApp] Loja nao encontrada ou WhatsApp desativado');
        }
      } catch (err) {
        console.warn('[WhatsApp] Erro ao conectar Supabase:', err.message);
        console.log('[WhatsApp] Usando credenciais globais como fallback');
      }
    } else {
      console.log('[WhatsApp] store_id nao fornecido, usando credenciais globais');
    }

    // Validar que temos customerId
    if (!customerId) {
      console.error('[WhatsApp] Nenhum customerId disponivel');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'CustomerId nao configurado',
          success: false,
        }),
      };
    }

    console.log(`[WhatsApp] Enviando para: ${normalizedPhone}`);
    console.log(`[WhatsApp] Fonte das credenciais: ${credentialsSource}`);
    console.log(`[WhatsApp] siteSlug: ${siteSlug}, customerId: ${customerId}`);

    // Preparar payload - Usar webhook Chatwoot para roteamento multi-tenant
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/webhook/chatwoot';
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
