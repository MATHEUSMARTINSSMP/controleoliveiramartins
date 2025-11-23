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
    // IMPORTANTE: Escapar a mensagem como string JSON para que funcione no n8n
    // Quando o n8n usar {{ $json.message }} no JSON body, ele precisa receber
    // uma string já escapada (com \n como \\n) para não quebrar o JSON
    const messageEscaped = JSON.stringify(message); // Adiciona aspas e escapa \n, etc.
    const messageSafe = messageEscaped.slice(1, -1); // Remove as aspas externas, mantém escapes
    
    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phoneNumber: normalizedPhone, // Número COM DDI 55 (ex: 5596981032928)
      message: messageSafe, // Mensagem já escapada para uso direto no JSON do n8n
    };

    console.log('📦 Payload enviado:', JSON.stringify(payload, null, 2));

    // Headers exatos conforme documentação e testes
    const headers = {
      'Content-Type': 'application/json',
      'x-app-key': webhookAuth, // Header em minúsculas conforme especificação
    };

    console.log('📦 Headers enviados:', JSON.stringify(headers, null, 2));
    console.log('📦 URL:', webhookUrl);
    console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    // Log detalhado da resposta
    console.log('📥 Status da resposta:', response.status, response.statusText);
    console.log('📥 Headers da resposta:', Object.fromEntries(response.headers.entries()));

    // Tentar ler resposta como JSON, mas tratar caso não seja
    let responseData;
    const responseText = await response.text();
    console.log('📥 Corpo da resposta (raw):', responseText);
    
    try {
      responseData = JSON.parse(responseText);
      console.log('📥 Corpo da resposta (parsed):', JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.warn('⚠️ Resposta não é JSON válido:', e);
      responseData = { message: responseText, raw: responseText };
    }

    if (!response.ok) {
      console.error('❌ Erro na resposta do webhook:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}: ${response.statusText}`);
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

