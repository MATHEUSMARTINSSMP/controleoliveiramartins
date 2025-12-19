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

// Import helper da API do Cakto (com tratamento de erro caso não exista)
let caktoApiClient = null;
try {
  caktoApiClient = require('./cakto-api-client');
} catch (error) {
  console.warn('[Payment Webhook] Cakto API client not available:', error.message);
}
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

    // Aceitar GET como health check / validação de webhook (Cakto pode usar para testar)
    if (event.httpMethod === 'GET') {
      console.log('[Payment Webhook] GET request received - treating as health check');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          message: 'Webhook endpoint is active',
          gateway: gateway,
          note: 'Webhooks should be sent as POST requests'
        }),
      };
    }

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
    let rawEventData;
    try {
      rawEventData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      eventData = rawEventData;
    } catch (e) {
      rawEventData = event.body;
      eventData = event.body;
    }

    // Para CAKTO, extrair dados corretamente
    // Estrutura: { "secret": "...", "event": "purchase_approved", "data": {...} }
    if (gateway.toUpperCase() === 'CAKTO' && rawEventData?.data) {
      eventData = rawEventData.data; // Usar data do Cakto como eventData
    }

    // Gerar ID único do evento (gateway pode não ter)
    // Para CAKTO, usar data.id ou id do root
    const eventId = (gateway.toUpperCase() === 'CAKTO' && rawEventData?.data?.id) 
                   ? rawEventData.data.id 
                   : eventData.id || 
                     eventData.data?.id || 
                     rawEventData?.id ||
                     `${gateway}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Para CAKTO, extrair event type do campo "event" do root
    const eventType = (gateway.toUpperCase() === 'CAKTO' && rawEventData?.event)
                     ? rawEventData.event
                     : eventData.type || 
                       eventData.action || 
                       eventData.event || 
                       'unknown';

    console.log('[Payment Webhook] Event ID:', eventId);
    console.log('[Payment Webhook] Event Type:', eventType);

    // Registrar evento no banco (para auditoria)
    // Nota: Se der erro de schema cache, continuar mesmo assim (não bloqueia processamento)
    try {
      const { error: eventError } = await supabase
        .schema('sistemaretiradas')
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
        console.warn('[Payment Webhook] Continuando processamento mesmo com erro ao salvar evento (não crítico)');
      } else {
        console.log('[Payment Webhook] Event saved to billing_events');
      }
    } catch (saveError) {
      console.error('[Payment Webhook] Exception saving event:', saveError);
      console.warn('[Payment Webhook] Continuando processamento mesmo com exceção ao salvar evento');
    }

    // Processar evento de acordo com gateway
    let result;
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        result = await handleStripeEvent(supabase, eventData);
        break;
      case 'CAKTO':
        // Para Cakto, passar rawEventData (com event, secret, data)
        result = await handleCaktoEvent(supabase, rawEventData);
        break;
      default:
        result = await handleGenericEvent(supabase, gateway, eventData);
    }

    // Marcar evento como processado (opcional, não bloqueia se falhar)
    try {
      await supabase
        .schema('sistemaretiradas')
        .from('billing_events')
        .update({ processed: true })
        .eq('payment_gateway', gateway)
        .eq('external_event_id', eventId.toString());
    } catch (updateError) {
      // Não bloquear resposta se falhar ao marcar como processado
      console.warn('[Payment Webhook] Could not mark event as processed:', updateError);
    }

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

  // O secret vem no nível raiz, não dentro de data
  const signature = eventData?.secret;

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

async function handleCaktoEvent(supabase, rawEventData) {
  console.log('[Payment Webhook] Processing CAKTO event');
  console.log('[Payment Webhook] rawEventData type:', typeof rawEventData);
  console.log('[Payment Webhook] rawEventData keys:', rawEventData ? Object.keys(rawEventData) : 'null/undefined');
  
  // Se rawEventData é undefined/null, tentar extrair do objeto raiz
  if (!rawEventData || typeof rawEventData !== 'object') {
    console.error('[Payment Webhook] CAKTO: rawEventData is invalid:', rawEventData);
    return { 
      success: false, 
      message: 'Invalid event data',
      error: 'rawEventData is missing or invalid'
    };
  }
  
  // Estrutura oficial do Cakto (conforme documentação):
  // {
  //   "secret": "123",
  //   "event": "purchase_approved",
  //   "data": { ... }
  // }
  
  // O evento vem no campo "event" (não "type")
  const eventType = rawEventData.event || rawEventData.type || 'unknown';
  
  // Os dados principais vêm em "data"
  const caktoData = rawEventData.data || rawEventData;
  
  console.log('[Payment Webhook] CAKTO Event Type:', eventType);
  console.log('[Payment Webhook] CAKTO Event Data (first 500 chars):', JSON.stringify(caktoData).substring(0, 500));

  // Processar eventos específicos do Cakto
  // Eventos disponíveis conforme documentação:
  // - purchase_approved: Compra aprovada
  // - subscription_renewed: Renovação de assinatura
  // - subscription_canceled: Cancelamento de assinatura
  // - purchase_refused: Compra recusada
  // - refund: Reembolso
  // - chargeback: Chargeback
  
  if (eventType === 'purchase_approved') {
    return await handleCaktoPurchaseApproved(supabase, caktoData);
  }
  
  if (eventType === 'subscription_renewed') {
    // Renovação de assinatura - similar a purchase_approved
    return await handleCaktoPurchaseApproved(supabase, caktoData);
  }
  
  if (eventType === 'subscription_created' || eventType === 'subscription_renewed') {
    // Criação ou renovação de assinatura - processar como purchase_approved
    console.log('[Payment Webhook] CAKTO: Processing subscription_created/renewed as purchase_approved');
    return await handleCaktoPurchaseApproved(supabase, caktoData);
  }
  
  if (eventType === 'subscription_canceled') {
    // Cancelamento de assinatura - atualizar subscription
    return await handleCaktoSubscriptionCanceled(supabase, caktoData);
  }
  
  // Outros eventos
  console.log('[Payment Webhook] CAKTO: Unhandled event type:', eventType);
  return { 
    success: true, 
    message: `Event ${eventType} received but not processed`,
    eventType 
  };
}

/**
 * Cria usuário ADMIN automaticamente quando compra é aprovada no Cakto
 */
async function handleCaktoPurchaseApproved(supabase, data) {
  console.log('[Payment Webhook] Processing CAKTO purchase approved - creating admin user');

  try {
    // Estrutura oficial do Cakto (baseado na documentação):
    // data.customer.email, data.customer.name
    // data.product.name, data.product.id
    // data.id (purchase ID), data.refId
    // data.amount, data.status
    
    const customerEmail = data.customer?.email;
    const customerName = data.customer?.name || customerEmail?.split('@')[0];
    
    const purchaseId = data.id || data.refId;
    const productId = data.product?.id;
    const planName = data.product?.name || data.offer?.name;
    const amount = data.amount || data.baseAmount;

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
      await updateCaktoSubscription(supabase, existingProfile.id, data, planName);
      
      return { 
        success: true, 
        message: 'Subscription updated for existing user',
        userId: existingProfile.id
      };
    }

    // Mapear plano do Cakto para nome do plano do sistema
    const planNameMapped = mapCaktoPlanToSystemPlanName(planName, amount);
    
    console.log('[Payment Webhook] CAKTO: Creating new admin user with plan:', planNameMapped);

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

    // Aguardar um pouco para garantir que o trigger criou o perfil
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verificar se perfil existe, se não existir, criar
    const { data: existingProfileCheck, error: profileCheckError } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfileCheck) {
      // Criar perfil se não existe (caso o trigger não tenha criado)
      console.log('[Payment Webhook] CAKTO: Profile does not exist, creating...');
      const { error: profileCreateError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .insert({
          id: userId,
          email: customerEmail.toLowerCase(),
          name: customerName || 'Cliente',
          role: 'ADMIN',
        });

      if (profileCreateError) {
        console.error('[Payment Webhook] CAKTO: Error creating profile:', profileCreateError);
        // Continuar mesmo com erro, pode ser que já exista
      } else {
        console.log('[Payment Webhook] CAKTO: ✅ Profile created');
      }
    } else {
      // Atualizar perfil existente para garantir role ADMIN
      const { error: profileUpdateError } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .update({
          role: 'ADMIN',
          name: customerName || 'Cliente',
          email: customerEmail.toLowerCase(),
        })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('[Payment Webhook] CAKTO: Error updating profile:', profileUpdateError);
      } else {
        console.log('[Payment Webhook] CAKTO: ✅ Profile updated to ADMIN');
      }
    }

    // IMPORTANTE: Verificar se há subscription trial criada pelo trigger
    // Se houver, deletar antes de criar a subscription paga do Cakto
    const { data: trialSubscription } = await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .select('id, plan_id')
      .eq('admin_id', userId)
      .eq('payment_status', 'TRIAL')
      .maybeSingle();

    if (trialSubscription) {
      console.log('[Payment Webhook] CAKTO: Trial subscription found, deleting before creating paid subscription');
      await supabase
        .schema('sistemaretiradas')
        .from('admin_subscriptions')
        .delete()
        .eq('id', trialSubscription.id);
    }

    // Criar subscription paga do Cakto (substitui trial se existir)
    await createCaktoSubscription(supabase, userId, data, planNameMapped);

    // Enviar email com credenciais
    // Tentar usar Netlify Function primeiro (mais confiável)
    try {
      const netlifyUrl = process.env.NETLIFY_URL || 
                        process.env.DEPLOY_PRIME_URL || 
                        'https://eleveaone.com.br';
      
      const welcomeEmailUrl = `${netlifyUrl}/.netlify/functions/send-welcome-email`;
      
      console.log('[Payment Webhook] CAKTO: Sending welcome email via Netlify Function:', welcomeEmailUrl);
      
      const emailResponse = await fetch(welcomeEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customerEmail.toLowerCase(),
          name: customerName || 'Cliente',
          password: generatedPassword,
        }),
      });

      if (emailResponse.ok) {
        console.log('[Payment Webhook] CAKTO: ✅ Welcome email sent via Netlify Function');
      } else {
        const errorText = await emailResponse.text();
        console.error('[Payment Webhook] CAKTO: Error sending welcome email via Netlify:', errorText);
        // Tentar Supabase Function como fallback
        await sendWelcomeEmailViaSupabase(supabase, customerEmail.toLowerCase(), customerName || 'Cliente', generatedPassword);
      }
    } catch (emailError) {
      console.error('[Payment Webhook] CAKTO: Error sending welcome email via Netlify:', emailError);
      // Tentar Supabase Function como fallback
      try {
        await sendWelcomeEmailViaSupabase(supabase, customerEmail.toLowerCase(), customerName || 'Cliente', generatedPassword);
      } catch (supabaseEmailError) {
        console.error('[Payment Webhook] CAKTO: Error sending welcome email via Supabase:', supabaseEmailError);
        // Não bloquear o processo por erro de email
      }
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
 * Mapeia o plano do Cakto para o nome do plano do sistema
 * Retorna o nome do plano (STARTER, BUSINESS, ENTERPRISE)
 */
function mapCaktoPlanToSystemPlanName(planName, amount) {
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
async function createCaktoSubscription(supabase, adminId, data, planName) {
  // Estrutura do Cakto: data.id ou data.refId para purchase ID
  const purchaseId = data.id || data.refId;
  const externalSubscriptionId = data.subscription?.id || purchaseId;

  // Buscar dados do plano pelo nome (não pelo ID)
  const { data: plan, error: planError } = await supabase
    .schema('sistemaretiradas')
    .from('subscription_plans')
    .select('id, name')
    .eq('name', planName)
    .eq('is_active', true)
    .single();

  let planId;
  
  if (planError || !plan) {
    console.error('[Payment Webhook] CAKTO: Plan not found (active):', planName, planError);
    // Tentar buscar sem filtro is_active como fallback
    const { data: planFallback, error: fallbackError } = await supabase
      .schema('sistemaretiradas')
      .from('subscription_plans')
      .select('id, name')
      .eq('name', planName)
      .single();
    
    if (fallbackError || !planFallback) {
      console.error('[Payment Webhook] CAKTO: Plan not found even with fallback:', planName, fallbackError);
      return;
    }
    
    console.log('[Payment Webhook] CAKTO: Plan found (inactive):', planFallback);
    planId = planFallback.id;
  } else {
    console.log('[Payment Webhook] CAKTO: Plan found (active):', plan);
    planId = plan.id;
  }

  // Verificar se já existe subscription para este admin
  const { data: existingSubscription } = await supabase
    .schema('sistemaretiradas')
    .from('admin_subscriptions')
    .select('id')
    .eq('admin_id', adminId)
    .maybeSingle();

  if (existingSubscription) {
    // Atualizar subscription existente
    console.log('[Payment Webhook] CAKTO: Updating existing subscription');
    const { error: updateError } = await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .update({
        plan_id: planId,
        payment_gateway: 'CAKTO',
        external_subscription_id: externalSubscriptionId?.toString(),
        status: 'ACTIVE',
        payment_status: 'PAID',
        gateway_metadata: data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id);

    if (updateError) {
      console.error('[Payment Webhook] CAKTO: Error updating subscription:', updateError);
    } else {
      console.log('[Payment Webhook] CAKTO: ✅ Subscription updated');
    }
  } else {
    // Criar nova subscription
    const { error: subError } = await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .insert({
        admin_id: adminId,
        plan_id: planId,
        payment_gateway: 'CAKTO',
        external_subscription_id: externalSubscriptionId?.toString(),
        status: 'ACTIVE',
        payment_status: 'PAID',
        gateway_metadata: data,
      });

    if (subError) {
      console.error('[Payment Webhook] CAKTO: Error creating subscription:', subError);
    } else {
      console.log('[Payment Webhook] CAKTO: ✅ Subscription created');
    }
  }
}

/**
 * Atualiza subscription existente
 */
async function updateCaktoSubscription(supabase, adminId, data, planName) {
  // Estrutura do Cakto: data.id ou data.refId para purchase ID
  const purchaseId = data.id || data.refId;
  const externalSubscriptionId = data.subscription?.id || purchaseId;

  const planNameMapped = mapCaktoPlanToSystemPlanName(planName, data.amount || data.baseAmount);

  // Buscar ID do plano pelo nome
  const { data: plan, error: planError } = await supabase
    .schema('sistemaretiradas')
    .from('subscription_plans')
    .select('id, name')
    .eq('name', planNameMapped)
    .single();

  let planId;
  
  if (planError || !plan) {
    console.error('[Payment Webhook] CAKTO: Plan not found in updateCaktoSubscription:', planNameMapped, planError);
    // Tentar buscar sem filtro is_active como fallback
    const { data: planFallback, error: fallbackError } = await supabase
      .schema('sistemaretiradas')
      .from('subscription_plans')
      .select('id, name')
      .eq('name', planNameMapped)
      .single();
    
    if (fallbackError || !planFallback) {
      console.error('[Payment Webhook] CAKTO: Plan not found even with fallback in updateCaktoSubscription:', planNameMapped, fallbackError);
      // Tentar criar subscription mesmo assim (vai falhar mas será logado)
      await createCaktoSubscription(supabase, adminId, data, planNameMapped);
      return;
    }
    
    planId = planFallback.id;
  } else {
    planId = plan.id;
  }

  // Atualizar ou criar subscription
  const { data: existingSub } = await supabase
    .schema('sistemaretiradas')
    .from('admin_subscriptions')
    .select('id')
    .eq('admin_id', adminId)
    .maybeSingle();

  if (existingSub) {
    await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .update({
        plan_id: planId,
        status: 'ACTIVE',
        payment_gateway: 'CAKTO',
        gateway_metadata: data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id);
  } else {
    await createCaktoSubscription(supabase, adminId, data, planNameMapped);
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

/**
 * Envia email de boas-vindas via Supabase Function (fallback)
 */
async function sendWelcomeEmailViaSupabase(supabase, email, name, password) {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const welcomeEmailUrl = `${supabaseUrl}/functions/v1/send-welcome-email`;
  
  console.log('[Payment Webhook] CAKTO: Trying Supabase Function for welcome email:', welcomeEmailUrl);
  
  const response = await fetch(welcomeEmailUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: email,
      name: name,
      password: password,
    }),
  });

  if (response.ok) {
    console.log('[Payment Webhook] CAKTO: ✅ Welcome email sent via Supabase Function');
  } else {
    const errorText = await response.text();
    throw new Error(`Supabase Function error: ${response.status} - ${errorText}`);
  }
}

/**
 * Trata cancelamento de assinatura do Cakto
 */
async function handleCaktoSubscriptionCanceled(supabase, data) {
  console.log('[Payment Webhook] Processing CAKTO subscription canceled');

  try {
    const customerEmail = data.customer?.email;
    
    if (!customerEmail) {
      console.error('[Payment Webhook] CAKTO: Missing customer email in subscription canceled event');
      return { 
        success: false, 
        message: 'Missing customer email',
        error: 'Cannot process cancellation without email'
      };
    }

    // Buscar usuário
    const { data: profile } = await supabase
      .schema('sistemaretiradas')
      .from('profiles')
      .select('id')
      .eq('email', customerEmail.toLowerCase())
      .maybeSingle();

    if (!profile) {
      console.warn('[Payment Webhook] CAKTO: User not found for cancellation:', customerEmail);
      return { 
        success: true, 
        message: 'User not found, nothing to cancel',
      };
    }

    // Buscar subscription ativa
    const { data: subscription } = await supabase
      .schema('sistemaretiradas')
      .from('admin_subscriptions')
      .select('id')
      .eq('admin_id', profile.id)
      .eq('payment_gateway', 'CAKTO')
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (subscription) {
      // Atualizar subscription para CANCELED
      const { error: updateError } = await supabase
        .schema('sistemaretiradas')
        .from('admin_subscriptions')
        .update({ 
          status: 'CANCELED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('[Payment Webhook] CAKTO: Error canceling subscription:', updateError);
        return { 
          success: false, 
          message: 'Error canceling subscription',
          error: updateError.message
        };
      }

      console.log('[Payment Webhook] CAKTO: ✅ Subscription canceled:', subscription.id);
      return { 
        success: true, 
        message: 'Subscription canceled successfully',
        subscriptionId: subscription.id
      };
    } else {
      console.warn('[Payment Webhook] CAKTO: No active subscription found to cancel');
      return { 
        success: true, 
        message: 'No active subscription found',
      };
    }

  } catch (error) {
    console.error('[Payment Webhook] CAKTO: Error in handleCaktoSubscriptionCanceled:', error);
    return { 
      success: false, 
      message: 'Error processing cancellation',
      error: error.message
    };
  }
}
