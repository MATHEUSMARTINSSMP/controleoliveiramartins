const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Envia mensagem WhatsApp via Webhook n8n Elevea
 * 
 * Variáveis de ambiente necessárias no Netlify:
 * - WHATSAPP_WEBHOOK_URL: URL do webhook n8n
 * - N8N_WEBHOOK_AUTH: Token de autenticação do webhook (x-app-key)
 * - UAZAPI_TOKEN: Token da API UAZAPI para envio de WhatsApp
 * - WHATSAPP_SITE_SLUG: Slug do site (padrão: elevea)
 * - N8N_CUSTOMER_ID: ID do cliente (email)
 * - UAZAPI_INSTANCE_ID: ID da instância UAZAPI (opcional)
 * 
 * Configuração:
 * - Webhook URL: Configure via variável de ambiente
 * - Auth Header: x-app-key (via N8N_WEBHOOK_AUTH)
 * - Formato: { siteSlug, customerId, phone_number, message, uazapi_token, uazapi_instance_id }
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

    // Normalizar telefone para WhatsApp (DDI + DDD + número)
    // Formato esperado: 55DDDXXXXXXXXX (ex: 5596981032928)
    // O webhook n8n espera número com DDI do país (55) mas sem @s.whatsapp.net
    const normalizePhone = (phoneNumber) => {
      if (!phoneNumber) return '';
      
      // 1. Remove todos os caracteres não numéricos
      let cleaned = phoneNumber.replace(/\D/g, '');
      
      // 2. Remove zero inicial se houver (ex: 096 -> 96)
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      
      // 3. Se já tem DDI 55 e está no tamanho correto (12 ou 13 dígitos), manter
      // Formato correto: 55 + DDD (2) + número (8 ou 9) = 12 ou 13 dígitos
      if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
        return cleaned; // Já está no formato correto
      }
      
      // 4. Se tem DDI 55 mas está muito longo (possível duplicação), remover o primeiro 55
      if (cleaned.startsWith('55') && cleaned.length > 13) {
        cleaned = cleaned.substring(2);
      }
      
      // 5. Validação de tamanho após limpeza (deve ter 10 ou 11 dígitos = DDD + número)
      if (cleaned.length < 10 || cleaned.length > 11) {
        console.warn(`[normalizePhone] ⚠️ Telefone com tamanho inválido após limpeza: ${cleaned.length} dígitos (${phoneNumber})`);
        // Se tiver menos de 10 dígitos, pode estar incompleto
        if (cleaned.length < 10) {
          return cleaned;
        }
      }
      
      // 6. Adiciona DDI 55 (Brasil) se não tiver
      if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
      }
      
      // 7. Verificar se o número após DDD começa com "99" (possível 9 duplicado)
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddi = cleaned.substring(0, 2); // 55
        const ddd = cleaned.substring(2, 4); // DDD (pode ser 96, 99, etc)
        const numero = cleaned.substring(4); // Número após DDI+DDD (9 dígitos)
        
        // Se o número começa com "99", pode haver um 9 duplicado
        if (numero.startsWith('99') && numero.length === 9) {
          // Remove o primeiro 9 do número: 55 + DDD + 99XXXXXXX -> 55 + DDD + 9XXXXXXX
          cleaned = ddi + ddd + numero.substring(1); // Remove primeiro dígito do número (um dos 9s)
          console.log(`[normalizePhone] 🔧 Removido 9 duplicado (número começa com 99): ${phoneNumber} -> ${cleaned}`);
        }
      }
      
      // 8. VERIFICAÇÃO EXTRA: Verificar de trás para frente se o 9º dígito do final é 9 extra
      // Celulares brasileiros: 55 + DDD (2) + 9 (celular) + 8 dígitos = 13 dígitos
      // Se o 9º e 10º dígitos a partir do final forem ambos 9, há duplicação
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const nonoDoFinal = cleaned[cleaned.length - 9]; // Índice: length - 9 (0-based)
        const decimoDoFinal = cleaned[cleaned.length - 10];
        
        // Se ambos são 9, há duplicação - remover o 9 extra (o 9º do final)
        if (nonoDoFinal === '9' && decimoDoFinal === '9') {
          // Remove o 9 extra: mantém tudo exceto o 9º dígito a partir do final
          const antes = cleaned.substring(0, cleaned.length - 9); // Tudo antes do 9 extra
          const depois = cleaned.substring(cleaned.length - 8); // Tudo depois do 9 extra
          cleaned = antes + depois;
          console.log(`[normalizePhone] 🔧 Removido 9 extra (verificação de trás para frente): ${phoneNumber} -> ${cleaned}`);
        }
      }
      
      // 9. Validação final: deve ter 12 dígitos (55 + DDD + 8 dígitos) ou 13 (55 + DDD + 9 dígitos)
      if (cleaned.length === 12 || cleaned.length === 13) {
        return cleaned;
      }
      
      console.warn(`[normalizePhone] ⚠️ Telefone normalizado com formato inesperado: ${cleaned} (${cleaned.length} dígitos, original: ${phoneNumber})`);
      return cleaned;
    };

    const normalizedPhone = normalizePhone(phone);
    // Credenciais via variáveis de ambiente
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send';
    const webhookAuth = process.env.N8N_WEBHOOK_AUTH;
    const uazapiToken = process.env.UAZAPI_TOKEN;
    const uazapiInstanceId = process.env.UAZAPI_INSTANCE_ID;
    const siteSlug = process.env.WHATSAPP_SITE_SLUG || 'elevea';
    const customerId = process.env.N8N_CUSTOMER_ID;

    console.log('📱 Enviando mensagem WhatsApp via Webhook n8n para:', normalizedPhone);
    console.log('📱 Webhook URL:', webhookUrl);
    console.log('📱 UAZAPI Token presente:', !!uazapiToken);
    console.log('📱 UAZAPI Instance ID:', uazapiInstanceId || 'não configurado');
    console.log('Mensagem:', message.substring(0, 50) + '...');

    // Validar token UAZAPI
    if (!uazapiToken) {
      console.error('❌ UAZAPI_TOKEN não configurado nas variáveis de ambiente do Netlify');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          error: 'Token UAZAPI não configurado. Verifique as variáveis de ambiente no Netlify.',
          success: false,
        }),
      };
    }

    // Enviar via Webhook n8n
    // Formato esperado: { siteSlug, customerId, phone_number, message, uazapi_token, uazapi_instance_id }
    // Header de autenticação: x-app-key (não Authorization)
    // IMPORTANTE: Escapar a mensagem como string JSON para que funcione no n8n
    // Quando o n8n usar {{ $json.message }} no JSON body, ele precisa receber
    // uma string já escapada (com \n como \\n) para não quebrar o JSON
    const messageEscaped = JSON.stringify(message); // Adiciona aspas e escapa \n, etc.
    const messageSafe = messageEscaped.slice(1, -1); // Remove as aspas externas, mantém escapes
    
    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phone_number: String(normalizedPhone), // snake_case + String() para garantir que não seja tratado como número
      message: messageSafe, // Mensagem já escapada para uso direto no JSON do n8n
      uazapi_token: uazapiToken, // Token UAZAPI para o workflow n8n usar
    };

    // Adicionar instance_id se configurado
    if (uazapiInstanceId) {
      payload.uazapi_instance_id = uazapiInstanceId;
    }

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

