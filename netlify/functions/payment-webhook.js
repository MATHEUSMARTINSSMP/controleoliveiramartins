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
    console.log('[Payment Webhook] Validating signature for gateway:', gateway);
    const validationResult = await validateWebhookSignature(supabase, gateway, event);
    console.log('[Payment Webhook] Validation result:', {
      valid: validationResult.valid,
      error: validationResult.error,
      gateway: gateway
    });
    
    if (!validationResult.valid) {
      console.error('[Payment Webhook] Signature validation failed:', validationResult.error);
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid signature', 
          details: validationResult.error,
          gateway: gateway,
          hint: 'Check if webhook_secret matches the secret sent by CAKTO'
        }),
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
        event_type: eventType,
        external_event_id: eventId.toString(),
        event_data: eventData,
        processed: false,
      });

    if (eventError) {
      console.error('[Payment Webhook] Error saving event:', eventError);
    }

    // Processar evento de acordo com gateway
    let result;
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        result = await handleStripeEvent(supabase, eventData);
        break;
      case 'CAKTO':
        result = await handleCaktoEvent(supabase, eventData);
        break;
      default:
        result = await handleGenericEvent(supabase, gateway, eventData);
    }

    // Marcar evento como processado
    await supabase
      .from('billing_events')
      .update({ processed: true })
      .eq('payment_gateway', gateway)
      .eq('external_event_id', eventId.toString());

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Event processed',
        result,
        gateway,
        eventType,
      }),
    };
  } catch (error) {
    console.error('[Payment Webhook] Error:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
    };
  }
};

async function validateWebhookSignature(supabase, gateway, event) {
  switch (gateway.toUpperCase()) {
    case 'STRIPE':
      return await validateStripeSignature(supabase, event);
    case 'CAKTO':
      return await validateCaktoSignature(supabase, event);
    default:
      // Para outros gateways, pode validar ou aceitar (conforme política de segurança)
      console.warn('[Payment Webhook] No signature validation for gateway:', gateway);
      return { valid: true };
  }
}

async function validateStripeSignature(supabase, event) {
  // Buscar webhook secret do Stripe (prioridade: env var > banco de dados)
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    const { data: gatewayConfig } = await supabase
      .from('payment_gateways')
      .select('webhook_secret')
      .eq('id', 'STRIPE')
      .single();
    
    webhookSecret = gatewayConfig?.webhook_secret;
  }

  if (!webhookSecret) {
    console.warn('[Payment Webhook] Stripe webhook secret not configured');
    return { valid: false, error: 'Webhook secret not configured' };
  }

  try {
    const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);
    const signature = event.headers['stripe-signature'];
    
    if (!signature) {
      return { valid: false, error: 'Missing stripe-signature header' };
    }

    stripeInstance.webhooks.constructEvent(event.body, signature, webhookSecret);
    return { valid: true };
  } catch (err) {
    console.error('[Payment Webhook] Stripe signature validation failed:', err.message);
    return { valid: false, error: err.message };
  }
}

async function validateCaktoSignature(supabase, event) {
  // CAKTO envia o secret no body do JSON, não no header
  let eventData;
  try {
    eventData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (e) {
    eventData = event.body;
  }

  const signature = eventData.secret || eventData.webhook_secret || eventData.signature;

  // Também verificar header (caso o CAKTO mude no futuro)
  const headerSignature = event.headers['x-cakto-signature'];

  if (!signature && !headerSignature) {
    console.warn('[Payment Webhook] CAKTO: No secret found in body or header');
    // CAKTO pode não enviar signature em alguns eventos - aceitar se configurado
    // return { valid: false, error: 'No CAKTO signature found' };
  }

  // Buscar webhook secret do CAKTO (prioridade: env var > banco de dados)
  let webhookSecret = process.env.CAKTO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    const { data: gatewayConfig } = await supabase
      .from('payment_gateways')
      .select('webhook_secret, active')
      .eq('id', 'CAKTO')
      .single();

    if (!gatewayConfig) {
      console.warn('[Payment Webhook] CAKTO gateway config not found, skipping signature validation');
      return { valid: true }; // Aceitar se não configurado (para facilitar setup inicial)
    }

    if (!gatewayConfig.active) {
      console.warn('[Payment Webhook] CAKTO gateway is not active, but validating signature anyway');
    }

    webhookSecret = gatewayConfig.webhook_secret;
  }

  if (!webhookSecret) {
    console.warn('[Payment Webhook] CAKTO webhook secret not configured, skipping validation');
    return { valid: true }; // Aceitar se não configurado (modo permissivo)
  }

  // CAKTO validação: comparar o secret recebido com o configurado
  if (signature === webhookSecret || headerSignature === webhookSecret) {
    console.log('[Payment Webhook] CAKTO signature validated successfully');
    return { valid: true };
  }

  console.error('[Payment Webhook] CAKTO signature mismatch. Received:', signature?.substring(0, 4) + '...', 'Expected:', webhookSecret?.substring(0, 4) + '...');
  return { valid: false, error: 'Invalid CAKTO webhook secret' };
}

async function handleStripeEvent(supabase, event) {
  console.log('[Payment Webhook] Processing Stripe event:', event.type);
  
  // Stripe já tem estrutura bem definida
  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
    // Criar/atualizar subscription
    const subscriptionId = event.data.object.subscription || event.data.object.id;
    const customerId = event.data.object.customer;
    
    if (subscriptionId) {
      await supabase.rpc('update_subscription_from_gateway', {
        p_payment_gateway: 'STRIPE',
        p_external_subscription_id: subscriptionId.toString(),
        p_gateway_data: event.data.object,
      });
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const subscriptionId = event.data.object.subscription;
    const paymentId = event.data.object.id;
    const amount = event.data.object.amount_paid / 100; // Stripe usa centavos
    
    if (subscriptionId && paymentId) {
      const { data: subscription } = await supabase
        .from('admin_subscriptions')
        .select('id, admin_id')
        .eq('payment_gateway', 'STRIPE')
        .eq('external_subscription_id', subscriptionId.toString())
        .single();

      if (subscription) {
        await supabase.rpc('record_payment', {
          p_subscription_id: subscription.id,
          p_payment_gateway: 'STRIPE',
          p_external_payment_id: paymentId.toString(),
          p_amount: amount,
          p_status: 'SUCCEEDED',
          p_gateway_response: event.data.object,
        });
      }
    }
  }

  return { success: true, message: 'Stripe event processed' };
}

async function handleCaktoEvent(supabase, event) {
  console.log('[Payment Webhook] Processing CAKTO event');
  
  // Extrair dados do evento Cakto
  const caktoEvent = event.data || event;
  
  // Mapear eventos do Cakto (ajustar conforme documentação oficial)
  // Eventos possíveis: purchase.approved, purchase.cancelled, subscription.created, etc.
  const eventType = caktoEvent.type || caktoEvent.event || caktoEvent.action || 'unknown';
  
  console.log('[Payment Webhook] CAKTO Event Type:', eventType);
  console.log('[Payment Webhook] CAKTO Event Data:', JSON.stringify(caktoEvent, null, 2));

  // Processar evento de compra aprovada (quando cliente faz checkout e pagamento é aprovado)
  if (eventType === 'purchase.approved' || eventType === 'purchase_approved' || 
      (eventType === 'unknown' && caktoEvent.status === 'approved')) {
    
    return await handleCaktoPurchaseApproved(supabase, caktoEvent);
  }

  // Processar outros eventos com handler genérico
  return await handleGenericEvent(supabase, 'CAKTO', event);
}

/**
 * Cria usuário ADMIN automaticamente quando compra é aprovada no Cakto
 */
async function handleCaktoPurchaseApproved(supabase, eventData) {
  console.log('[Payment Webhook] Processing CAKTO purchase approved - creating admin user');

  try {
    // Extrair dados do cliente e da compra
    // Ajustar campos conforme estrutura real do webhook do Cakto
    const customerEmail = eventData.customer?.email || 
                         eventData.email || 
                         eventData.customer_email ||
                         eventData.purchase?.customer?.email;
    
    const customerName = eventData.customer?.name || 
                        eventData.name || 
                        eventData.customer_name ||
                        eventData.purchase?.customer?.name ||
                        customerEmail?.split('@')[0]; // Fallback: usar parte do email

    const purchaseId = eventData.purchase_id || 
                      eventData.id || 
                      eventData.purchase?.id;

    const productId = eventData.product_id || 
                     eventData.product?.id ||
                     eventData.purchase?.product_id;

    const planName = eventData.plan_name ||
                    eventData.product?.name ||
                    eventData.purchase?.product_name ||
                    eventData.plan;

    const amount = eventData.amount || 
                  eventData.value || 
                  eventData.purchase?.amount;

    console.log('[Payment Webhook] CAKTO Purchase Data:', {
      customerEmail,
      customerName,
      purchaseId,
      productId,
      planName,
      amount,
    });

    if (!customerEmail) {
      console.error('[Payment Webhook] CAKTO: Missing customer email in event');
      return { 
        success: false, 
        message: 'Missing customer email',
        error: 'Cannot create user without email'
      };
    }

    // Verificar se usuário já existe
    const { data: existingProfile } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id, role, email')
      .eq('email', customerEmail.toLowerCase())
      .single();

    if (existingProfile) {
      console.log('[Payment Webhook] CAKTO: User already exists, updating subscription:', existingProfile.id);
      
      // Atualizar subscription existente
      await updateCaktoSubscription(supabase, existingProfile.id, eventData, planName);
      
      return { 
        success: true, 
        message: 'Subscription updated for existing user',
        userId: existingProfile.id
      };
    }

    // Mapear plano do Cakto para plano do sistema
    const planId = mapCaktoPlanToSystemPlan(planName, amount);
    
    console.log('[Payment Webhook] CAKTO: Creating new admin user with plan:', planId);

    // Gerar senha aleatória
    const generatedPassword = generateRandomPassword();
    
    // Criar usuário ADMIN
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email: customerEmail.toLowerCase(),
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        name: customerName || 'Cliente',
        role: 'ADMIN',
        cakto_purchase_id: purchaseId,
      },
    });

    if (authError || !userData?.user) {
      console.error('[Payment Webhook] CAKTO: Error creating auth user:', authError);
      return { 
        success: false, 
        message: 'Failed to create user',
        error: authError?.message || 'Unknown error'
      };
    }

    const userId = userData.user.id;
    console.log('[Payment Webhook] CAKTO: ✅ User created:', userId);

    // Atualizar perfil para garantir role ADMIN
    const { error: profileError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .update({
        role: 'ADMIN',
        name: customerName || 'Cliente',
        email: customerEmail.toLowerCase(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[Payment Webhook] CAKTO: Error updating profile:', profileError);
    }

    // Criar subscription
    await createCaktoSubscription(supabase, userId, eventData, planId);

    // Enviar email com credenciais
    try {
      const welcomeEmailUrl = `${process.env.SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co'}/functions/v1/send-welcome-email`;
      
      await fetch(welcomeEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          email: customerEmail.toLowerCase(),
          name: customerName || 'Cliente',
          password: generatedPassword,
        }),
      });

      console.log('[Payment Webhook] CAKTO: ✅ Welcome email sent');
    } catch (emailError) {
      console.error('[Payment Webhook] CAKTO: Error sending welcome email:', emailError);
      // Não bloquear o processo por erro de email
    }

    return { 
      success: true, 
      message: 'Admin user created successfully',
      userId,
      email: customerEmail.toLowerCase(),
    };

  } catch (error) {
    console.error('[Payment Webhook] CAKTO: Error in handleCaktoPurchaseApproved:', error);
    return { 
      success: false, 
      message: 'Error processing purchase',
      error: error.message
    };
  }
}

/**
 * Mapeia o plano do Cakto para o plano do sistema
 */
function mapCaktoPlanToSystemPlan(planName, amount) {
  if (!planName) {
    // Tentar identificar pelo valor
    const amountNum = parseFloat(amount) || 0;
    if (amountNum >= 700) return 'ENTERPRISE';
    if (amountNum >= 450) return 'BUSINESS';
    return 'STARTER';
  }

  const planUpper = planName.toUpperCase();
  
  if (planUpper.includes('ENTERPRISE') || planUpper.includes('EMPRESARIAL')) {
    return 'ENTERPRISE';
  }
  if (planUpper.includes('BUSINESS') || planUpper.includes('NEGÓCIO')) {
    return 'BUSINESS';
  }
  if (planUpper.includes('STARTER') || planUpper.includes('INICIAL') || planUpper.includes('BÁSICO')) {
    return 'STARTER';
  }

  // Fallback por valor
  const amountNum = parseFloat(amount) || 0;
  if (amountNum >= 700) return 'ENTERPRISE';
  if (amountNum >= 450) return 'BUSINESS';
  return 'STARTER';
}

/**
 * Cria subscription no sistema para usuário Cakto
 */
async function createCaktoSubscription(supabase, adminId, eventData, planId) {
  const purchaseId = eventData.purchase_id || eventData.id || eventData.purchase?.id;
  const externalSubscriptionId = eventData.subscription_id || 
                                eventData.subscription?.id || 
                                purchaseId;

  // Buscar dados do plano
  const { data: plan } = await supabase
    .schema('sistemaretiradas')
    .from('subscription_plans')
    .select('id, name')
    .eq('id', planId)
    .single();

  if (!plan) {
    console.error('[Payment Webhook] CAKTO: Plan not found:', planId);
    return;
  }

  // Criar subscription
  const { error: subError } = await supabase
    .schema('sistemaretiradas')
    .from('admin_subscriptions')
    .insert({
      admin_id: adminId,
      plan_id: planId,
      payment_gateway: 'CAKTO',
      external_subscription_id: externalSubscriptionId?.toString(),
      status: 'ACTIVE',
      gateway_data: eventData,
    });

  if (subError) {
    console.error('[Payment Webhook] CAKTO: Error creating subscription:', subError);
  } else {
    console.log('[Payment Webhook] CAKTO: ✅ Subscription created');
  }
}

/**
 * Atualiza subscription existente
 */
async function updateCaktoSubscription(supabase, adminId, eventData, planName) {
  const purchaseId = eventData.purchase_id || eventData.id;
  const externalSubscriptionId = eventData.subscription_id || 
                                eventData.subscription?.id || 
                                purchaseId;

  const planId = mapCaktoPlanToSystemPlan(planName, eventData.amount);

  // Atualizar ou criar subscription
  const { data: existingSub } = await supabase
    .schema('sistemaretiradas')
    .from('admin_subscriptions')
    .select('id')
    .eq('admin_id', adminId)
    .eq('payment_gateway', 'CAKTO')
    .maybeSingle();

  if (existingSub) {
    await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .update({
        plan_id: planId,
        status: 'ACTIVE',
        gateway_data: eventData,
      })
      .eq('id', existingSub.id);
  } else {
    await createCaktoSubscription(supabase, adminId, eventData, planId);
  }
}

/**
 * Gera senha aleatória segura
 */
function generateRandomPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  
  // Garantir pelo menos uma maiúscula, uma minúscula, um número e um caractere especial
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%&*'[Math.floor(Math.random() * 7)];
  
  // Completar o resto
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('');
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
