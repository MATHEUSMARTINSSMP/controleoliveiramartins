const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifica status da conexão WhatsApp
 * 
 * Busca o status atual da conexão WhatsApp na tabela whatsapp_credentials
 * 
 * Variáveis de ambiente necessárias:
 * - SUPABASE_URL: URL do Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Service Role Key
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

    console.log('[WhatsApp Status] Verificando status:', { customer_id, site_slug, store_id });

    // Conectar ao Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { db: { schema: 'sistemaretiradas' } }
    );

    // Buscar credenciais
    const { data: credentials, error } = await supabase
      .from('whatsapp_credentials')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('site_slug', site_slug)
      .maybeSingle();

    if (error) {
      console.error('[WhatsApp Status] Erro ao buscar credenciais:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Erro ao buscar credenciais: ' + error.message,
          success: false,
        }),
      };
    }

    if (!credentials) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          success: true,
          status: 'not_configured',
          message: 'WhatsApp não configurado',
          data: null,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        status: credentials.uazapi_status || 'disconnected',
        qr_code: credentials.uazapi_qr_code,
        instance_id: credentials.uazapi_instance_id,
        phone_number: credentials.uazapi_phone_number,
        instance_name: credentials.whatsapp_instance_name,
        data: credentials,
      }),
    };
  } catch (error) {
    console.error('[WhatsApp Status] ❌ Erro:', error);
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

