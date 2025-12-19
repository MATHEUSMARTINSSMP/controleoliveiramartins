-- ============================================================================
-- VERIFICAÇÃO COMPLETA DA VENDA DE TESTE
-- Email: amapagarden@loungerie.com.br
-- Purchase ID: 014ecc94-53e8-44c5-aeb9-2e29e37cc73e
-- User ID: 714fb285-bc69-4db7-aa88-f8f7c3a67f92
-- ============================================================================

-- 1. Verificar se usuário foi criado no Auth
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'amapagarden@loungerie.com.br'
   OR id = '714fb285-bc69-4db7-aa88-f8f7c3a67f92';

-- 2. Verificar se perfil foi criado
SELECT 
  id,
  email,
  name,
  role,
  is_active,
  created_at
FROM sistemaretiradas.profiles
WHERE email = 'amapagarden@loungerie.com.br'
   OR id = '714fb285-bc69-4db7-aa88-f8f7c3a67f92';

-- 3. Verificar se subscription foi criada
SELECT 
  a.id,
  a.admin_id,
  a.plan_id,
  a.status,
  a.payment_gateway,
  a.payment_status,
  a.external_subscription_id,
  a.created_at,
  p.name AS plan_name,
  p.email AS admin_email
FROM sistemaretiradas.admin_subscriptions a
LEFT JOIN sistemaretiradas.subscription_plans sp ON sp.id = a.plan_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = a.admin_id
WHERE a.admin_id = '714fb285-bc69-4db7-aa88-f8f7c3a67f92'
   OR p.email = 'amapagarden@loungerie.com.br'
   OR a.external_subscription_id = '014ecc94-53e8-44c5-aeb9-2e29e37cc73e';

-- 4. Verificar quais planos existem no sistema
SELECT 
  id,
  name,
  display_name,
  description,
  is_active
FROM sistemaretiradas.subscription_plans
ORDER BY name;

-- 5. Verificar se o plano STARTER existe
SELECT 
  id,
  name,
  display_name,
  is_active
FROM sistemaretiradas.subscription_plans
WHERE name = 'STARTER'
   OR name ILIKE '%starter%'
   OR display_name ILIKE '%starter%';

-- 6. Verificar eventos salvos (se houver)
SELECT 
  id,
  payment_gateway,
  event_type,
  external_event_id,
  processed,
  created_at
FROM sistemaretiradas.billing_events
WHERE external_event_id = '014ecc94-53e8-44c5-aeb9-2e29e37cc73e'
ORDER BY created_at DESC
LIMIT 5;


