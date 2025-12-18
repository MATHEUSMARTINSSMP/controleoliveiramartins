-- ============================================================================
-- FIX: Adicionar suporte ao plano TRIAL (14 dias de teste)
-- Data: 2025-12-18
-- 
-- Funcionalidade:
-- 1. Adicionar coluna trial_end_date na tabela admin_subscriptions
-- 2. Criar plano TRIAL na tabela subscription_plans
-- 3. Atualizar função check_and_update_admin_billing_status para verificar trial
-- 4. Criar função para criar trial de 14 dias automaticamente
-- 5. Restringir acesso após 7 dias após o fim do trial (21 dias total)
-- ============================================================================

-- ============================================================================
-- PARTE 1: Adicionar coluna trial_end_date
-- ============================================================================

ALTER TABLE sistemaretiradas.admin_subscriptions
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.trial_end_date IS 'Data de fim do período de trial (14 dias após criação). Após 7 dias do fim do trial (21 dias total), acesso é restringido se não houver assinatura ativa.';

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_trial_end_date 
ON sistemaretiradas.admin_subscriptions(trial_end_date) 
WHERE trial_end_date IS NOT NULL;

-- ============================================================================
-- PARTE 2: Criar plano TRIAL na tabela subscription_plans
-- ============================================================================

INSERT INTO sistemaretiradas.subscription_plans (
    name,
    display_name,
    description,
    price_monthly,
    max_stores,
    max_colaboradoras_total,
    cashback_enabled,
    erp_integration_enabled,
    whatsapp_notifications_enabled,
    is_active
) VALUES (
    'TRIAL',
    'Período de Teste',
    '14 dias de acesso completo para teste de todas as funcionalidades',
    0.00,
    1,
    5,
    true,
    false,
    false,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- PARTE 3: Função para criar trial automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.create_trial_subscription(p_admin_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_trial_plan_id UUID;
    v_subscription_id UUID;
    v_trial_end_date TIMESTAMPTZ;
BEGIN
    -- Buscar ID do plano TRIAL
    SELECT id INTO v_trial_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE name = 'TRIAL' AND is_active = true
    LIMIT 1;

    IF v_trial_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano TRIAL não encontrado ou inativo';
    END IF;

    -- Calcular data de fim do trial (14 dias a partir de agora)
    v_trial_end_date := NOW() + INTERVAL '14 days';

    -- Criar subscription com status TRIAL
    INSERT INTO sistemaretiradas.admin_subscriptions (
        admin_id,
        plan_id,
        status,
        payment_status,
        billing_cycle,
        payment_gateway,
        trial_end_date,
        current_period_end,
        created_at,
        updated_at
    ) VALUES (
        p_admin_id,
        v_trial_plan_id,
        'ACTIVE',
        'TRIAL',
        'MONTHLY',
        'TRIAL',
        v_trial_end_date,
        v_trial_end_date,
        NOW(),
        NOW()
    )
    ON CONFLICT (admin_id) DO NOTHING
    RETURNING id INTO v_subscription_id;

    -- Se já existe subscription, retornar ID existente
    IF v_subscription_id IS NULL THEN
        SELECT id INTO v_subscription_id
        FROM sistemaretiradas.admin_subscriptions
        WHERE admin_id = p_admin_id
        LIMIT 1;
    END IF;

    RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.create_trial_subscription(UUID) IS 'Cria subscription TRIAL de 14 dias para um admin';

-- ============================================================================
-- PARTE 4: Atualizar função check_and_update_admin_billing_status para suportar TRIAL
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.check_and_update_admin_billing_status(p_admin_id UUID)
RETURNS TABLE (
  has_access BOOLEAN,
  reason TEXT,
  message TEXT,
  days_overdue INTEGER,
  access_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
  v_subscription RECORD;
  v_days_overdue INTEGER := 0;
  v_current_period_end TIMESTAMPTZ;
  v_last_payment_date TIMESTAMPTZ;
  v_trial_end_date TIMESTAMPTZ;
  v_status TEXT;
  v_payment_status TEXT;
  v_should_be_active BOOLEAN := TRUE;
  v_access_level TEXT := 'FULL';
  v_days_since_trial_end INTEGER := 0;
BEGIN
  -- Buscar assinatura do admin
  SELECT 
    asub.status,
    asub.last_payment_status,
    asub.current_period_end,
    asub.last_payment_date,
    asub.next_billing_date,
    asub.trial_end_date,
    sp.name AS plan_name
  INTO v_subscription
  FROM sistemaretiradas.admin_subscriptions asub
  LEFT JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
  WHERE asub.admin_id = p_admin_id
  ORDER BY asub.created_at DESC
  LIMIT 1;

  -- Se não há assinatura, criar trial automaticamente (se for admin novo)
  IF v_subscription IS NULL THEN
    -- Tentar criar trial
    BEGIN
      PERFORM sistemaretiradas.create_trial_subscription(p_admin_id);
      
      -- Buscar novamente a subscription criada
      SELECT 
        asub.status,
        asub.last_payment_status,
        asub.current_period_end,
        asub.last_payment_date,
        asub.next_billing_date,
        asub.trial_end_date,
        sp.name AS plan_name
      INTO v_subscription
      FROM sistemaretiradas.admin_subscriptions asub
      LEFT JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
      WHERE asub.admin_id = p_admin_id
      ORDER BY asub.created_at DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- Se falhar ao criar trial, considerar como inativo
      UPDATE sistemaretiradas.profiles
      SET is_active = FALSE
      WHERE id = p_admin_id AND role = 'ADMIN';
      
      RETURN QUERY SELECT 
        FALSE::BOOLEAN,
        'NO_SUBSCRIPTION'::TEXT,
        'Nenhuma assinatura encontrada e não foi possível criar trial'::TEXT,
        0::INTEGER,
        'BLOCKED'::TEXT;
      RETURN;
    END;
  END IF;

  -- Se ainda não encontrou, considerar inativo
  IF v_subscription IS NULL THEN
    UPDATE sistemaretiradas.profiles
    SET is_active = FALSE
    WHERE id = p_admin_id AND role = 'ADMIN';
    
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      'NO_SUBSCRIPTION'::TEXT,
      'Nenhuma assinatura encontrada'::TEXT,
      0::INTEGER,
      'BLOCKED'::TEXT;
    RETURN;
  END IF;

  v_status := v_subscription.status;
  v_payment_status := v_subscription.last_payment_status;
  v_current_period_end := v_subscription.current_period_end;
  v_last_payment_date := v_subscription.last_payment_date;
  v_trial_end_date := v_subscription.trial_end_date;

  -- LÓGICA ESPECIAL PARA TRIAL
  IF v_subscription.plan_name = 'TRIAL' OR v_payment_status = 'TRIAL' THEN
    -- Se está em trial e ainda não terminou
    IF v_trial_end_date IS NOT NULL AND v_trial_end_date > NOW() THEN
      -- Trial ativo: acesso completo
      v_access_level := 'FULL';
      v_should_be_active := TRUE;
      
      UPDATE sistemaretiradas.profiles
      SET is_active = TRUE
      WHERE id = p_admin_id AND role = 'ADMIN';
      
      RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        'TRIAL_ACTIVE'::TEXT,
        format('Período de teste ativo até %s', to_char(v_trial_end_date, 'DD/MM/YYYY HH24:MI'))::TEXT,
        0::INTEGER,
        'FULL'::TEXT;
      RETURN;
    END IF;
    
    -- Trial terminou: calcular dias desde o fim
    IF v_trial_end_date IS NOT NULL AND v_trial_end_date <= NOW() THEN
      v_days_since_trial_end := EXTRACT(DAY FROM (NOW() - v_trial_end_date))::INTEGER;
      
      -- Se passou mais de 7 dias após o fim do trial (21 dias total), bloquear
      IF v_days_since_trial_end >= 7 THEN
        v_access_level := 'BLOCKED';
        v_should_be_active := FALSE;
        
        UPDATE sistemaretiradas.profiles
        SET is_active = FALSE
        WHERE id = p_admin_id AND role = 'ADMIN';
        
        RETURN QUERY SELECT 
          FALSE::BOOLEAN,
          'TRIAL_EXPIRED_BLOCKED'::TEXT,
          format('Período de teste expirado há %s dias. Assine um plano para continuar.', v_days_since_trial_end)::TEXT,
          v_days_since_trial_end::INTEGER,
          'BLOCKED'::TEXT;
        RETURN;
      END IF;
      
      -- Se passou menos de 7 dias após o fim do trial, ainda permitir acesso com aviso
      IF v_days_since_trial_end >= 3 THEN
        v_access_level := 'READ_ONLY';
        v_should_be_active := TRUE;
      ELSIF v_days_since_trial_end >= 1 THEN
        v_access_level := 'WARNING';
        v_should_be_active := TRUE;
      ELSE
        v_access_level := 'FULL';
        v_should_be_active := TRUE;
      END IF;
      
      UPDATE sistemaretiradas.profiles
      SET is_active = v_should_be_active
      WHERE id = p_admin_id AND role = 'ADMIN';
      
      RETURN QUERY SELECT 
        v_should_be_active::BOOLEAN,
        'TRIAL_EXPIRED'::TEXT,
        format('Período de teste expirado há %s dias. Assine um plano para continuar.', v_days_since_trial_end)::TEXT,
        v_days_since_trial_end::INTEGER,
        v_access_level::TEXT;
      RETURN;
    END IF;
  END IF;

  -- LÓGICA PARA PLANOS PAGOS (mantém comportamento original)
  -- Calcular dias de atraso
  IF v_current_period_end IS NOT NULL AND v_current_period_end < NOW() THEN
    v_days_overdue := EXTRACT(DAY FROM (NOW() - v_current_period_end))::INTEGER;
  END IF;

  -- Determinar nível de acesso baseado em dias de atraso
  IF v_status = 'ACTIVE' AND v_payment_status = 'PAID' AND v_days_overdue = 0 THEN
    -- Em dia: acesso total
    v_access_level := 'FULL';
    v_should_be_active := TRUE;
  ELSIF v_days_overdue >= 7 THEN
    -- 7+ dias: bloqueio total (exceto aba billing)
    v_access_level := 'BLOCKED';
    v_should_be_active := FALSE;
  ELSIF v_days_overdue >= 3 THEN
    -- 3-6 dias: modo read-only
    v_access_level := 'READ_ONLY';
    v_should_be_active := TRUE;
  ELSIF v_days_overdue >= 2 THEN
    -- 2 dias: aviso visual
    v_access_level := 'WARNING';
    v_should_be_active := TRUE;
  ELSE
    -- 0-1 dia: acesso normal
    v_access_level := 'FULL';
    v_should_be_active := TRUE;
  END IF;

  -- Atualizar is_active do perfil baseado no status
  UPDATE sistemaretiradas.profiles
  SET is_active = v_should_be_active
  WHERE id = p_admin_id AND role = 'ADMIN';

  -- Retornar status
  RETURN QUERY SELECT 
    v_should_be_active::BOOLEAN,
    CASE 
      WHEN v_days_overdue >= 7 THEN 'PAYMENT_OVERDUE_BLOCKED'::TEXT
      WHEN v_days_overdue >= 3 THEN 'PAYMENT_OVERDUE_READ_ONLY'::TEXT
      WHEN v_days_overdue >= 2 THEN 'PAYMENT_OVERDUE_WARNING'::TEXT
      WHEN v_status = 'ACTIVE' AND v_payment_status = 'PAID' THEN 'PAID'::TEXT
      ELSE 'PAYMENT_REQUIRED'::TEXT
    END,
    CASE 
      WHEN v_days_overdue >= 7 THEN format('Pagamento atrasado há %s dias. Acesso bloqueado.', v_days_overdue)
      WHEN v_days_overdue >= 3 THEN format('Pagamento atrasado há %s dias. Acesso somente leitura.', v_days_overdue)
      WHEN v_days_overdue >= 2 THEN format('Pagamento atrasado há %s dias. Regularize seu pagamento.', v_days_overdue)
      WHEN v_status = 'ACTIVE' AND v_payment_status = 'PAID' THEN 'Pagamento em dia'
      ELSE 'Pagamento pendente'
    END,
    v_days_overdue,
    v_access_level;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_and_update_admin_billing_status(UUID) IS 'Verifica billing status e atualiza is_active automaticamente, incluindo suporte para TRIAL (14 dias + 7 dias de tolerância)';

-- ============================================================================
-- PARTE 5: Criar trigger para criar trial automaticamente quando admin é criado
-- ============================================================================

-- Função do trigger
CREATE OR REPLACE FUNCTION sistemaretiradas.auto_create_trial_on_admin_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
  -- Se é um admin novo e não tem subscription, criar trial
  IF NEW.role = 'ADMIN' THEN
    -- Verificar se já existe subscription
    IF NOT EXISTS (
      SELECT 1 
      FROM sistemaretiradas.admin_subscriptions 
      WHERE admin_id = NEW.id
    ) THEN
      -- Criar trial
      PERFORM sistemaretiradas.create_trial_subscription(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Dropar trigger se existir
DROP TRIGGER IF EXISTS trigger_auto_create_trial_on_admin_create ON sistemaretiradas.profiles;

-- Criar trigger
CREATE TRIGGER trigger_auto_create_trial_on_admin_create
  AFTER INSERT ON sistemaretiradas.profiles
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.auto_create_trial_on_admin_create();

COMMENT ON TRIGGER trigger_auto_create_trial_on_admin_create ON sistemaretiradas.profiles IS 'Cria trial de 14 dias automaticamente quando um admin é criado';

-- ============================================================================
-- PARTE 6: Garantir permissões
-- ============================================================================

GRANT EXECUTE ON FUNCTION sistemaretiradas.create_trial_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.create_trial_subscription(UUID) TO service_role;

