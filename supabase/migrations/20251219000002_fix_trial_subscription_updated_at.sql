-- ============================================================================
-- FIX: Remover referência a updated_at na função create_trial_subscription
-- Data: 2025-12-19
-- 
-- Problema: 
-- - Função create_trial_subscription tenta inserir updated_at que não existe
-- - Isso causa erro ao criar profile ADMIN (trigger dispara função)
-- 
-- Solução:
-- - Remover updated_at do INSERT na função
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

    -- Criar subscription com status TRIAL (SEM updated_at)
    INSERT INTO sistemaretiradas.admin_subscriptions (
        admin_id,
        plan_id,
        status,
        payment_status,
        billing_cycle,
        payment_gateway,
        trial_end_date,
        current_period_end,
        created_at
    ) VALUES (
        p_admin_id,
        v_trial_plan_id,
        'ACTIVE',
        'TRIAL',
        'MONTHLY',
        'TRIAL',
        v_trial_end_date,
        v_trial_end_date,
        NOW()
    )
    ON CONFLICT (admin_id) DO NOTHING
    RETURNING id INTO v_subscription_id;

    RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.create_trial_subscription IS 'Cria subscription TRIAL de 14 dias para admin (corrigido - sem updated_at)';

