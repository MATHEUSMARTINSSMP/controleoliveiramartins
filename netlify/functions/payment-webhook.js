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

