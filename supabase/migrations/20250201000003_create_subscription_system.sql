-- ============================================================================
-- MIGRATION: Sistema de Planos e Licenciamento
-- Data: 2025-02-01
-- Descrição: Sistema comercial com planos Starter, Business e Enterprise
-- ============================================================================

-- ============================================================================
-- 1. TABELA: subscription_plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    
    -- Limites (COLABORADORAS AGORA SÃO TOTAIS, NÃO POR LOJA)
    max_stores INTEGER NOT NULL DEFAULT 1,
    max_colaboradoras_total INTEGER NOT NULL DEFAULT 5, -- TOTAL de colaboradoras (todas as lojas)
    
    -- Módulos
    cashback_enabled BOOLEAN NOT NULL DEFAULT true,
    erp_integration_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    reports_enabled BOOLEAN NOT NULL DEFAULT true,
    goals_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Preços (centavos)
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON sistemaretiradas.subscription_plans(is_active);

COMMENT ON COLUMN sistemaretiradas.subscription_plans.max_colaboradoras_total IS 'Total de colaboradoras permitidas (somando todas as lojas)';

-- ============================================================================
-- 2. TABELA: subscription_addons
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    addon_type TEXT NOT NULL CHECK (addon_type IN ('STORE', 'COLABORADORAS', 'MODULE')),
    adds_stores INTEGER DEFAULT 0,
    adds_colaboradoras INTEGER DEFAULT 0,
    price_monthly INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. TABELA: admin_subscriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.admin_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES sistemaretiradas.subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL')),
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT admin_subscriptions_unique_admin UNIQUE(admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_admin ON sistemaretiradas.admin_subscriptions(admin_id);

-- ============================================================================
-- 4. TABELA: admin_subscription_addons
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.admin_subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES sistemaretiradas.admin_subscriptions(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES sistemaretiradas.subscription_addons(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT admin_subscription_addons_unique UNIQUE(subscription_id, addon_id)
);

-- ============================================================================
-- 5. FUNÇÃO: get_admin_limits
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.get_admin_limits(p_admin_id UUID)
RETURNS TABLE (
    max_stores INTEGER,
    max_colaboradoras_total INTEGER,
    cashback_enabled BOOLEAN,
    erp_integration_enabled BOOLEAN,
    whatsapp_notifications_enabled BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_plan sistemaretiradas.subscription_plans;
    v_extra_stores INTEGER := 0;
    v_extra_colaboradoras INTEGER := 0;
BEGIN
    -- Buscar plano do admin
    SELECT p.* INTO v_plan
    FROM sistemaretiradas.admin_subscriptions asub
    JOIN sistemaretiradas.subscription_plans p ON p.id = asub.plan_id
    WHERE asub.admin_id = p_admin_id
      AND asub.status = 'ACTIVE'
    LIMIT 1;
    
    -- Se não tem assinatura, retornar limites padrão
    IF v_plan IS NULL THEN
        RETURN QUERY SELECT 1::INTEGER, 5::INTEGER, true, true, true;
        RETURN;
    END IF;
    
    -- Calcular addons
    SELECT 
        COALESCE(SUM(a.adds_stores * asa.quantity), 0),
        COALESCE(SUM(a.adds_colaboradoras * asa.quantity), 0)
    INTO v_extra_stores, v_extra_colaboradoras
    FROM sistemaretiradas.admin_subscription_addons asa
    JOIN sistemaretiradas.subscription_addons a ON a.id = asa.addon_id
    JOIN sistemaretiradas.admin_subscriptions asub ON asub.id = asa.subscription_id
    WHERE asub.admin_id = p_admin_id
      AND asa.is_active = true;
    
    -- Retornar limites efetivos
    RETURN QUERY SELECT
        (v_plan.max_stores + v_extra_stores)::INTEGER,
        (v_plan.max_colaboradoras_total + v_extra_colaboradoras)::INTEGER,
        v_plan.cashback_enabled,
        v_plan.erp_integration_enabled,
        v_plan.whatsapp_notifications_enabled;
END;
$$;

-- ============================================================================
-- 6. FUNÇÃO: can_create_store
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_store(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_current_stores INTEGER;
    v_max_stores INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_current_stores
    FROM sistemaretiradas.stores
    WHERE admin_id = p_admin_id AND active = true;
    
    SELECT max_stores INTO v_max_stores
    FROM sistemaretiradas.get_admin_limits(p_admin_id);
    
    RETURN v_current_stores < v_max_stores;
END;
$$;

-- ============================================================================
-- 7. FUNÇÃO: can_create_colaboradora (AGORA VERIFICA TOTAL)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_colaboradora(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_current_colaboradoras INTEGER;
    v_max_colaboradoras INTEGER;
BEGIN
    -- Contar TODAS as colaboradoras do admin (em todas as lojas)
    SELECT COUNT(*) INTO v_current_colaboradoras
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON s.id = p.store_id
    WHERE s.admin_id = p_admin_id
      AND p.role = 'COLABORADORA'
      AND p.active = true;
    
    SELECT max_colaboradoras_total INTO v_max_colaboradoras
    FROM sistemaretiradas.get_admin_limits(p_admin_id);
    
    RETURN v_current_colaboradoras < v_max_colaboradoras;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.can_create_colaboradora IS 'Verifica se admin pode criar colaboradora (conta TOTAL em todas as lojas)';

-- ============================================================================
-- 8. INSERIR PLANOS
-- ============================================================================

-- STARTER: R$ 249/mês - 1 loja, 5 colaboradoras TOTAL
INSERT INTO sistemaretiradas.subscription_plans (
    name, display_name, description,
    max_stores, max_colaboradoras_total,
    cashback_enabled, erp_integration_enabled, whatsapp_notifications_enabled,
    price_monthly, price_yearly, sort_order
) VALUES (
    'STARTER', 'Starter', 'Ideal para começar. 1 loja, 5 colaboradoras.',
    1, 5, -- 1 loja, 5 colaboradoras TOTAL
    true, true, true,
    24900, 249000, -- R$ 249/mês, R$ 2.490/ano
    1
) ON CONFLICT (name) DO UPDATE SET
    max_stores = 1,
    max_colaboradoras_total = 5,
    price_monthly = 24900,
    price_yearly = 249000;

-- BUSINESS: R$ 499/mês - 3 lojas, 25 colaboradoras TOTAL
INSERT INTO sistemaretiradas.subscription_plans (
    name, display_name, description,
    max_stores, max_colaboradoras_total,
    cashback_enabled, erp_integration_enabled, whatsapp_notifications_enabled,
    price_monthly, price_yearly, sort_order
) VALUES (
    'BUSINESS', 'Business', 'Para crescimento. 3 lojas, 25 colaboradoras.',
    3, 25, -- 3 lojas, 25 colaboradoras TOTAL
    true, true, true,
    49900, 499000, -- R$ 499/mês, R$ 4.990/ano
    2
) ON CONFLICT (name) DO UPDATE SET
    max_stores = 3,
    max_colaboradoras_total = 25,
    price_monthly = 49900,
    price_yearly = 499000;

-- ENTERPRISE: R$ 799/mês - 7 lojas, 80 colaboradoras TOTAL
INSERT INTO sistemaretiradas.subscription_plans (
    name, display_name, description,
    max_stores, max_colaboradoras_total,
    cashback_enabled, erp_integration_enabled, whatsapp_notifications_enabled,
    price_monthly, price_yearly, sort_order
) VALUES (
    'ENTERPRISE', 'Enterprise', 'Para grandes operações. 7 lojas, 80 colaboradoras.',
    7, 80, -- 7 lojas, 80 colaboradoras TOTAL
    true, true, true,
    79900, 799000, -- R$ 799/mês, R$ 7.990/ano
    3
) ON CONFLICT (name) DO UPDATE SET
    max_stores = 7,
    max_colaboradoras_total = 80,
    price_monthly = 79900,
    price_yearly = 799000;

-- ============================================================================
-- 9. INSERIR ADDONS
-- ============================================================================

-- Loja Extra: R$ 100/mês
INSERT INTO sistemaretiradas.subscription_addons (
    name, display_name, description,
    addon_type, adds_stores, price_monthly
) VALUES (
    'EXTRA_STORE', 'Loja Extra', 'Adicione mais uma loja',
    'STORE', 1, 10000 -- R$ 100/mês
) ON CONFLICT (name) DO UPDATE SET
    price_monthly = 10000;

-- 5 Colaboradoras Extras: R$ 49/mês
INSERT INTO sistemaretiradas.subscription_addons (
    name, display_name, description,
    addon_type, adds_colaboradoras, price_monthly
) VALUES (
    'EXTRA_COLABORADORAS_5', '+5 Colaboradoras', 'Adicione 5 colaboradoras extras',
    'COLABORADORAS', 5, 4900 -- R$ 49/mês
) ON CONFLICT (name) DO UPDATE SET
    adds_colaboradoras = 5,
    price_monthly = 4900;

-- ============================================================================
-- 10. CRIAR ASSINATURA PARA ADMINS EXISTENTES (BUSINESS)
-- ============================================================================
INSERT INTO sistemaretiradas.admin_subscriptions (admin_id, plan_id, status, billing_cycle)
SELECT 
    p.id,
    (SELECT id FROM sistemaretiradas.subscription_plans WHERE name = 'BUSINESS' LIMIT 1),
    'ACTIVE',
    'MONTHLY'
FROM sistemaretiradas.profiles p
WHERE p.role = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM sistemaretiradas.admin_subscriptions WHERE admin_id = p.id)
ON CONFLICT (admin_id) DO NOTHING;

-- ============================================================================
-- 11. RLS
-- ============================================================================
ALTER TABLE sistemaretiradas.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.admin_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.admin_subscription_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active plans" ON sistemaretiradas.subscription_plans;
CREATE POLICY "Anyone can view active plans" ON sistemaretiradas.subscription_plans
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active addons" ON sistemaretiradas.subscription_addons;
CREATE POLICY "Anyone can view active addons" ON sistemaretiradas.subscription_addons
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin can view own subscription" ON sistemaretiradas.admin_subscriptions;
CREATE POLICY "Admin can view own subscription" ON sistemaretiradas.admin_subscriptions
    FOR SELECT USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view own addons" ON sistemaretiradas.admin_subscription_addons;
CREATE POLICY "Admin can view own addons" ON sistemaretiradas.admin_subscription_addons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.admin_subscriptions
            WHERE id = subscription_id AND admin_id = auth.uid()
        )
    );
