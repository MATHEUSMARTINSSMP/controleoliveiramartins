/**
 * Netlify Function: Payment Webhook Handler (Genérico)
 * 
 * Processa eventos de webhook de qualquer gateway de pagamento
 * Endpoint: /.netlify/functions/payment-webhook
 * 
 * Suporta múltiplos gateways: Stripe, Mercado Pago, PagSeguro, Asaas, CAKTO, etc
 * 
 * Configurar webhook no gateway de pagamento apontando para:
 * https://eleveaone.com.br/.netlify/functions/payment-webhook
 * 
 * Query params opcionais:
 * ?gateway=STRIPE (ou MERCADO_PAGO, PAGSEGURO, ASAAS, CAKTO, etc)
 */

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-signature, x-asaas-signature, x-cakto-signature',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Detectar gateway (query param ou header)
    const gateway = event.queryStringParameters?.gateway || 
                    event.headers['x-gateway'] || 
                    'CUSTOM';
    
    console.log('[Payment Webhook] Gateway:', gateway);
    console.log('[Payment Webhook] Method:', event.httpMethod);

    // Criar cliente Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Supabase configuration missing' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    });

    // Validar assinatura antes de processar (segurança crítica)
    const validationResult = await validateWebhookSignature(supabase, gateway, event);
    if (!validationResult.valid) {
      console.error('[Payment Webhook] Signature validation failed:', validationResult.error);
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid signature', details: validationResult.error }),
      };
    }

    // Processar body (pode ser JSON ou string)
    let eventData;
    try {
      eventData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      eventData = event.body;
    }

    // Gerar ID único do evento (gateway pode não ter)
    const eventId = eventData.id || 
                   eventData.data?.id || 
                   `${gateway}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const eventType = eventData.type || 
                     eventData.action || 
                     eventData.event || 
                     'unknown';

    console.log('[Payment Webhook] Event ID:', eventId);
    console.log('[Payment Webhook] Event Type:', eventType);

    // Registrar evento no banco (para auditoria)
    const { error: eventError } = await supabase
      .from('billing_events')
      .insert({
        payment_gateway: gateway,
        external_event_id: eventId,
        event_type: eventType,
        event_data: eventData,
        processed: false,
      });

    if (eventError) {
      console.error('[Payment Webhook] Error saving event:', eventError);
    }

    // Processar evento baseado no gateway
    let result = { success: true, message: 'Event processed' };

    // Router genérico - cada gateway pode ter handlers específicos
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        result = await handleStripeEvent(supabase, eventData);
        break;
      case 'MERCADO_PAGO':
        result = await handleMercadoPagoEvent(supabase, eventData);
        break;
      case 'PAGSEGURO':
        result = await handlePagSeguroEvent(supabase, eventData);
        break;
      case 'ASAAS':
        result = await handleAsaasEvent(supabase, eventData);
        break;
      case 'CAKTO':
        result = await handleCaktoEvent(supabase, eventData);
        break;
      default:
        // Handler genérico - tenta extrair dados comuns
        result = await handleGenericEvent(supabase, gateway, eventData);
    }

    // Marcar evento como processado
    await supabase
      .from('billing_events')
      .update({ processed: true })
      .eq('payment_gateway', gateway)
      .eq('external_event_id', eventId);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[Payment Webhook] Error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

// =====================================================
// VALIDAÇÃO DE ASSINATURA DE WEBHOOK
// =====================================================

async function validateWebhookSignature(supabase, gateway, event) {
  const gatewayUpper = gateway.toUpperCase();
  
  try {
    switch (gatewayUpper) {
      case 'STRIPE':
        return await validateStripeSignature(supabase, event);
      case 'MERCADO_PAGO':
        return await validateMercadoPagoSignature(supabase, event);
      case 'ASAAS':
        return await validateAsaasSignature(supabase, event);
      case 'CAKTO':
        return await validateCaktoSignature(supabase, event);
      default:
        // Para gateways sem validação específica, verificar se há secret configurado
        return await validateGenericSignature(supabase, gateway, event);
    }
  } catch (error) {
    console.error(`[Payment Webhook] Error validating ${gateway} signature:`, error);
    return { valid: false, error: error.message };
  }
}

async function validateStripeSignature(supabase, event) {
  const signature = event.headers['stripe-signature'];
  
  if (!signature) {
    return { valid: false, error: 'Missing stripe-signature header' };
  }

  // Buscar webhook secret do Stripe na tabela payment_gateways
  const { data: gatewayConfig, error } = await supabase
    .from('payment_gateways')
    .select('webhook_secret, api_key')
    .eq('id', 'STRIPE')
    .eq('is_active', true)
    .single();

  if (error || !gatewayConfig) {
    console.warn('[Payment Webhook] Stripe gateway config not found, skipping signature validation');
    // Se não há configuração, permitir (modo desenvolvimento)
    return { valid: true };
  }

  const webhookSecret = gatewayConfig.webhook_secret;
  
  if (!webhookSecret) {
    console.warn('[Payment Webhook] Stripe webhook secret not configured, skipping validation');
    return { valid: true }; // Permitir se não configurado (modo desenvolvimento)
  }

  try {
    // Criar cliente Stripe com API key (se disponível)
    const stripeClient = gatewayConfig.api_key 
      ? stripe(gatewayConfig.api_key)
      : stripe(process.env.STRIPE_SECRET_KEY || '');

    // Validar assinatura usando o webhook secret
    stripeClient.webhooks.constructEvent(
      event.body,
      signature,
      webhookSecret
    );

    return { valid: true };
  } catch (err) {
    console.error('[Payment Webhook] Stripe signature validation error:', err.message);
    return { valid: false, error: `Invalid Stripe signature: ${err.message}` };
  }
}

async function validateMercadoPagoSignature(supabase, event) {
  // Mercado Pago usa x-signature e x-request-id nos headers
  const signature = event.headers['x-signature'];
  const requestId = event.headers['x-request-id'];
  
  if (!signature) {
    return { valid: false, error: 'Missing x-signature header' };
  }

  // Buscar webhook secret do Mercado Pago
  const { data: gatewayConfig, error } = await supabase
    .from('payment_gateways')
    .select('webhook_secret')
    .eq('id', 'MERCADO_PAGO')
    .eq('is_active', true)
    .single();

  if (error || !gatewayConfig) {
    console.warn('[Payment Webhook] Mercado Pago gateway config not found');
    return { valid: true }; // Permitir se não configurado
  }

  const webhookSecret = gatewayConfig.webhook_secret;
  
  if (!webhookSecret) {
    return { valid: true }; // Permitir se não configurado
  }

  // Mercado Pago validação: signature = HMAC-SHA256(body + request_id, webhook_secret)
  // Implementar conforme documentação oficial do Mercado Pago
  // Por enquanto, retornar válido se secret existe
  // TODO: Implementar validação HMAC-SHA256 completa
  return { valid: true };
}

async function validateAsaasSignature(supabase, event) {
  const signature = event.headers['x-asaas-signature'];
  
  if (!signature) {
    return { valid: false, error: 'Missing x-asaas-signature header' };
  }

  // Buscar webhook secret do Asaas
  const { data: gatewayConfig, error } = await supabase
    .from('payment_gateways')
    .select('webhook_secret')
    .eq('id', 'ASAAS')
    .eq('is_active', true)
    .single();

  if (error || !gatewayConfig) {
    return { valid: true };
  }

  const webhookSecret = gatewayConfig.webhook_secret;
  
  if (!webhookSecret) {
    return { valid: true };
  }

  // Asaas validação: implementar conforme documentação
  // TODO: Implementar validação específica do Asaas
  return { valid: true };
}

async function validateCaktoSignature(supabase, event) {
  const signature = event.headers['x-cakto-signature'];
  
  if (!signature) {
    return { valid: false, error: 'Missing x-cakto-signature header' };
  }

  // Buscar webhook secret do CAKTO (prioridade: env var > banco de dados)
  let webhookSecret = process.env.CAKTO_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    // Se não estiver em env var, buscar do banco de dados
    const { data: gatewayConfig, error } = await supabase
      .from('payment_gateways')
      .select('webhook_secret')
      .eq('id', 'CAKTO')
      .eq('is_active', true)
      .single();

    if (error || !gatewayConfig) {
      console.warn('[Payment Webhook] CAKTO gateway config not found, skipping signature validation');
      return { valid: true }; // Permitir se não configurado (modo desenvolvimento)
    }

    webhookSecret = gatewayConfig.webhook_secret;
  }
  
  if (!webhookSecret) {
    console.warn('[Payment Webhook] CAKTO webhook secret not configured, skipping validation');
    return { valid: true }; // Permitir se não configurado
  }

  // CAKTO validação: implementar conforme documentação
  // Por enquanto, validar se a signature corresponde ao secret
  // TODO: Implementar validação específica do CAKTO conforme documentação oficial
  // Exemplo básico: verificar se signature é igual ao secret (adaptar conforme docs do CAKTO)
  if (signature === webhookSecret) {
    return { valid: true };
  }
  
  // Se não corresponder, pode ser um hash - implementar validação HMAC se necessário
  return { valid: true }; // Por enquanto, aceitar se secret existe
}

async function validateGenericSignature(supabase, gateway, event) {
  // Para gateways genéricos, verificar se há secret configurado
  const { data: gatewayConfig, error } = await supabase
    .from('payment_gateways')
    .select('webhook_secret')
    .eq('id', gateway.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !gatewayConfig || !gatewayConfig.webhook_secret) {
    // Se não há configuração, permitir (modo desenvolvimento)
    return { valid: true };
  }

  // Validação genérica: comparar signature header com secret
  // Implementar conforme necessário
  return { valid: true };
}

// =====================================================
// HANDLERS GENÉRICOS (podem ser adaptados conforme necessário)
// =====================================================

async function handleStripeEvent(supabase, event) {
  // Implementação específica do Stripe (se necessário)
  return await handleGenericEvent(supabase, 'STRIPE', event);
}

async function handleMercadoPagoEvent(supabase, event) {
  // Implementação específica do Mercado Pago (se necessário)
  return await handleGenericEvent(supabase, 'MERCADO_PAGO', event);
}

async function handlePagSeguroEvent(supabase, event) {
  // Implementação específica do PagSeguro (se necessário)
  return await handleGenericEvent(supabase, 'PAGSEGURO', event);
}

async function handleAsaasEvent(supabase, event) {
  // Implementação específica do Asaas (se necessário)
  return await handleGenericEvent(supabase, 'ASAAS', event);
}

async function handleCaktoEvent(supabase, event) {
  console.log('[Payment Webhook] Processing CAKTO event');
  
  // CAKTO pode ter estrutura específica - adaptar conforme documentação
  // Por enquanto, usa handler genérico que extrai dados comuns
  // TODO: Implementar lógica específica do CAKTO se necessário
  
  // Exemplo de extração específica do CAKTO (adaptar conforme documentação real)
  const caktoEvent = event.data || event;
  
  // CAKTO pode usar campos como:
  // - subscription_id ou subscriptionId
  // - payment_id ou paymentId
  // - status ou paymentStatus
  // - amount ou value
  
  return await handleGenericEvent(supabase, 'CAKTO', event);
}

async function handleGenericEvent(supabase, gateway, eventData) {
  console.log('[Payment Webhook] Processing generic event for gateway:', gateway);
  
  // Tentar extrair dados comuns
  const subscriptionId = eventData.data?.object?.subscription ||
                        eventData.data?.object?.subscription_id ||
                        eventData.subscription_id ||
                        eventData.subscription;

  const paymentId = eventData.data?.object?.id ||
                   eventData.data?.object?.payment_id ||
                   eventData.payment_id ||
                   eventData.id;

  const amount = eventData.data?.object?.amount ||
                eventData.data?.object?.amount_paid ||
                eventData.amount ||
                eventData.value;

  const status = eventData.data?.object?.status ||
                eventData.status ||
                eventData.data?.status;

  const eventType = eventData.type || eventData.action || eventData.event;

  console.log('[Payment Webhook] Extracted data:', {
    subscriptionId,
    paymentId,
    amount,
    status,
    eventType,
  });

  // Se encontrou subscription, atualizar
  if (subscriptionId) {
    await supabase.rpc('update_subscription_from_gateway', {
      p_payment_gateway: gateway,
      p_external_subscription_id: subscriptionId.toString(),
      p_gateway_data: eventData.data?.object || eventData,
    });
  }

  // Se é evento de pagamento, registrar
  if (eventType && (eventType.includes('payment') || eventType.includes('invoice'))) {
    if (subscriptionId && paymentId) {
      const { data: subscription } = await supabase
        .from('admin_subscriptions')
        .select('id, admin_id')
        .eq('payment_gateway', gateway)
        .eq('external_subscription_id', subscriptionId.toString())
        .single();

      if (subscription) {
        await supabase.rpc('record_payment', {
          p_subscription_id: subscription.id,
          p_payment_gateway: gateway,
          p_external_payment_id: paymentId.toString(),
          p_amount: amount || 0,
          p_status: mapGenericStatus(status),
          p_gateway_response: eventData,
        });
      }
    }
  }

  return { success: true, message: `Event processed for ${gateway}` };
}

function mapGenericStatus(status) {
  if (!status) return 'PENDING';
  
  const statusUpper = status.toUpperCase();
  
  if (statusUpper.includes('SUCCESS') || statusUpper.includes('PAID') || statusUpper.includes('COMPLETED')) {
    return 'SUCCEEDED';
  }
  if (statusUpper.includes('FAIL') || statusUpper.includes('ERROR')) {
    return 'FAILED';
  }
  if (statusUpper.includes('REFUND')) {
    return 'REFUNDED';
  }
  if (statusUpper.includes('CANCEL')) {
    return 'CANCELED';
  }
  
  return 'PENDING';
}

