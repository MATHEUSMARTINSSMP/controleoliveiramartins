-- Script para atualizar plano do usuário para ENTERPRISE
-- Email: matheusmartinss@icloud.com
-- Schema: sistemaretiradas

-- 1. Verificar usuário atual
SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    asub.id as subscription_id,
    sp.name as plan_name,
    asub.status,
    asub.started_at,
    asub.expires_at
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.admin_subscriptions asub ON asub.admin_id = p.id
LEFT JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
WHERE p.email = 'matheusmartinss@icloud.com';

-- 2. Obter ID do plano ENTERPRISE
SELECT id, name, max_stores, max_colaboradoras_total
FROM sistemaretiradas.subscription_plans
WHERE name = 'ENTERPRISE';

-- 3. Atualizar ou criar assinatura ENTERPRISE para o usuário
-- Primeiro, obter o ID do usuário e do plano ENTERPRISE
DO $$
DECLARE
    v_user_id UUID;
    v_enterprise_plan_id UUID;
BEGIN
    -- Buscar ID do usuário
    SELECT id INTO v_user_id
    FROM sistemaretiradas.profiles
    WHERE email = 'matheusmartinss@icloud.com'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado com email: matheusmartinss@icloud.com';
    END IF;

    -- Buscar ID do plano ENTERPRISE
    SELECT id INTO v_enterprise_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE name = 'ENTERPRISE'
    LIMIT 1;

    IF v_enterprise_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plano ENTERPRISE não encontrado';
    END IF;

    -- Upsert da assinatura
    INSERT INTO sistemaretiradas.admin_subscriptions (
        admin_id,
        plan_id,
        status,
        billing_cycle,
        started_at
    ) VALUES (
        v_user_id,
        v_enterprise_plan_id,
        'ACTIVE',
        'MONTHLY',
        NOW()
    )
    ON CONFLICT (admin_id) 
    DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'ACTIVE',
        started_at = COALESCE(admin_subscriptions.started_at, NOW()),
        updated_at = NOW();

    RAISE NOTICE 'Plano atualizado para ENTERPRISE para o usuário: %', v_user_id;
END $$;

-- 4. Verificar resultado
SELECT 
    p.email,
    p.name,
    sp.name as plan_name,
    asub.status,
    asub.started_at,
    asub.billing_cycle
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.admin_subscriptions asub ON asub.admin_id = p.id
JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
WHERE p.email = 'matheusmartinss@icloud.com';

