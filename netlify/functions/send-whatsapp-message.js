const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Envia mensagem WhatsApp via Webhook n8n Elevea
 * 
 * Variáveis de ambiente necessárias no Netlify:
 * - WHATSAPP_WEBHOOK_URL: URL do webhook (padrão: https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send)
 * - WHATSAPP_WEBHOOK_AUTH: Token de autenticação do webhook (padrão: #mmP220411)
 * - WHATSAPP_SITE_SLUG: Slug do site (padrão: elevea)
 * - WHATSAPP_CUSTOMER_ID: ID do cliente (opcional, pode ser email)
 * 
 * Configuração:
 * - Webhook URL: https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send
 * - Auth Header: x-app-key: #mmP220411
 * - Formato: { siteSlug, customerId, phoneNumber, message }
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
    const { phone, message } = JSON.parse(event.body || '{}');

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

    // Normalizar telefone para o formato esperado pelo webhook n8n
    // O webhook n8n espera número com DDI do país (55) mas sem @s.whatsapp.net
    const normalizePhone = (phoneNumber) => {
      // Remove todos os caracteres não numéricos
      let cleaned = phoneNumber.replace(/\D/g, '');
      
      // Se começar com 0, remove
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      
      // Se não começar com 55 (Brasil), adiciona
      // O webhook precisa do DDI do país
      if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
      }
      
      // Não adiciona @s.whatsapp.net (o webhook não precisa disso)
      return cleaned;
    };

    const normalizedPhone = normalizePhone(phone);
    // Usando EXATAMENTE as mesmas credenciais do teste que funcionou
    const webhookUrl = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send';
    const webhookAuth = '#mmP220411';
    const siteSlug = 'elevea';
    const customerId = 'mathmartins@gmail.com';

    console.log('📱 Enviando mensagem WhatsApp via Webhook n8n para:', normalizedPhone);
    console.log('📱 Webhook URL:', webhookUrl);
    console.log('Mensagem:', message.substring(0, 50) + '...');

    // Enviar via Webhook n8n
    // Formato esperado: { siteSlug, customerId, phoneNumber, message }
    // Header de autenticação: x-app-key (não Authorization)
    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phoneNumber: normalizedPhone, // Número COM DDI 55 (ex: 5596981032928)
      message: message,
    };

    console.log('📦 Payload enviado:', JSON.stringify(payload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-APP-KEY': webhookAuth, // Header de autenticação: X-APP-KEY (exatamente como no teste)
      },
      body: JSON.stringify(payload),
    });

    // Tentar ler resposta como JSON, mas tratar caso não seja
    let responseData;
    const responseText = await response.text();
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(responseData.message || `HTTP ${response.status}`);
    }

    console.log('✅ Mensagem WhatsApp enviada com sucesso:', responseData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: responseData,
      }),
    };
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
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

