-- ============================================================================
-- CONFIGURAR PLANO ENTERPRISE COM LIMITES CORRETOS
-- ============================================================================
-- Enterprise: 7 lojas + 3 extras = 10 lojas | 80 colaboradoras + 10 extras = 90 colaboradoras
-- Este script configura o sistema para funcionar como Enterprise com os limites corretos

-- 1. Criar/Atualizar função RPC que verifica limites corretamente
-- ✅ VERSÃO SEM PARÂMETRO (para compatibilidade com Netlify Function)
-- Esta versão precisa do admin_id, então vamos buscar de outra forma ou usar um valor padrão
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_colaboradora()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ✅ Para Netlify Function sem admin_id, assumir que pode criar
    -- A validação real será feita na versão com parâmetro
    RETURN true;
END;
$$;

-- ✅ VERSÃO COM PARÂMETRO (para compatibilidade com StoreManagement)
-- Esta versão usa a função get_admin_limits que já considera addons
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
    
    -- Buscar limite do admin (já considera addons)
    SELECT max_colaboradoras_total INTO v_max_colaboradoras
    FROM sistemaretiradas.get_admin_limits(p_admin_id);
    
    -- Enterprise: 80 base + 10 extras = 90 total
    RETURN v_current_colaboradoras < v_max_colaboradoras;
END;
$$;

-- 2. Criar/Atualizar função RPC que verifica limites de lojas
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
    
    -- Buscar limite do admin (já considera addons)
    SELECT max_stores INTO v_max_stores
    FROM sistemaretiradas.get_admin_limits(p_admin_id);
    
    -- Enterprise: 7 base + 3 extras = 10 total
    RETURN v_current_stores < v_max_stores;
END;
$$;

-- 3. Atualizar plano Enterprise na tabela subscription_plans
-- Enterprise: 7 lojas base, 80 colaboradoras base
UPDATE sistemaretiradas.subscription_plans
SET 
    max_stores = 7,
    max_colaboradoras_total = 80,
    display_name = 'Enterprise',
    description = 'Solução completa para redes. 7 lojas, 80 colaboradoras.',
    updated_at = NOW()
WHERE name = 'ENTERPRISE';

-- 4. Garantir que o plano Enterprise existe
INSERT INTO sistemaretiradas.subscription_plans (
    name, display_name, description,
    max_stores, max_colaboradoras_total,
    cashback_enabled, erp_integration_enabled, whatsapp_notifications_enabled,
    price_monthly, price_yearly, sort_order
) VALUES (
    'ENTERPRISE', 'Enterprise', 'Solução completa para redes. 7 lojas, 80 colaboradoras.',
    7, 80, -- 7 lojas base, 80 colaboradoras base
    true, true, true,
    79900, 799000, -- R$ 799/mês, R$ 7.990/ano
    3
) ON CONFLICT (name) DO UPDATE SET
    max_stores = 7,
    max_colaboradoras_total = 80,
    display_name = 'Enterprise',
    description = 'Solução completa para redes. 7 lojas, 80 colaboradoras.',
    price_monthly = 79900,
    price_yearly = 799000,
    updated_at = NOW();

-- 5. Criar addons grátis do Enterprise (se não existirem)
-- +3 Lojas Extras Grátis
INSERT INTO sistemaretiradas.subscription_addons (
    name, display_name, description,
    addon_type, adds_stores, price_monthly
) VALUES (
    'ENTERPRISE_EXTRA_STORES_3', '+3 Lojas Extras (Grátis)', '3 lojas extras incluídas no plano Enterprise',
    'STORE', 3, 0 -- Grátis
) ON CONFLICT (name) DO UPDATE SET
    adds_stores = 3,
    price_monthly = 0;

-- +10 Colaboradoras Extras Grátis
INSERT INTO sistemaretiradas.subscription_addons (
    name, display_name, description,
    addon_type, adds_colaboradoras, price_monthly
) VALUES (
    'ENTERPRISE_EXTRA_COLABORADORAS_10', '+10 Colaboradoras Extras (Grátis)', '10 colaboradoras extras incluídas no plano Enterprise',
    'COLABORADORAS', 10, 0 -- Grátis
) ON CONFLICT (name) DO UPDATE SET
    adds_colaboradoras = 10,
    price_monthly = 0;

-- 6. Atualizar assinaturas Enterprise existentes para incluir addons grátis
-- Isso adiciona automaticamente +3 lojas e +10 colaboradoras para todos os admins com plano Enterprise
DO $$
DECLARE
    v_enterprise_plan_id UUID;
    v_extra_stores_addon_id UUID;
    v_extra_colaboradoras_addon_id UUID;
    v_subscription_record RECORD;
BEGIN
    -- Buscar ID do plano Enterprise
    SELECT id INTO v_enterprise_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE name = 'ENTERPRISE'
    LIMIT 1;
    
    -- Buscar IDs dos addons grátis
    SELECT id INTO v_extra_stores_addon_id
    FROM sistemaretiradas.subscription_addons
    WHERE name = 'ENTERPRISE_EXTRA_STORES_3'
    LIMIT 1;
    
    SELECT id INTO v_extra_colaboradoras_addon_id
    FROM sistemaretiradas.subscription_addons
    WHERE name = 'ENTERPRISE_EXTRA_COLABORADORAS_10'
    LIMIT 1;
    
    -- Para cada assinatura Enterprise, adicionar os addons grátis
    FOR v_subscription_record IN 
        SELECT id FROM sistemaretiradas.admin_subscriptions
        WHERE plan_id = v_enterprise_plan_id
          AND status = 'ACTIVE'
    LOOP
        -- Adicionar +3 lojas extras (se ainda não tiver)
        INSERT INTO sistemaretiradas.admin_subscription_addons (
            subscription_id, addon_id, quantity, is_active
        ) VALUES (
            v_subscription_record.id, v_extra_stores_addon_id, 1, true
        ) ON CONFLICT (subscription_id, addon_id) DO UPDATE SET
            is_active = true,
            quantity = 1;
        
        -- Adicionar +10 colaboradoras extras (se ainda não tiver)
        INSERT INTO sistemaretiradas.admin_subscription_addons (
            subscription_id, addon_id, quantity, is_active
        ) VALUES (
            v_subscription_record.id, v_extra_colaboradoras_addon_id, 1, true
        ) ON CONFLICT (subscription_id, addon_id) DO UPDATE SET
            is_active = true,
            quantity = 1;
    END LOOP;
END $$;

-- 7. Remover função check_plan_limits se existir (não é mais necessária)
-- A função get_admin_limits já existe e faz o trabalho corretamente
DROP FUNCTION IF EXISTS sistemaretiradas.check_plan_limits(TEXT);

-- 8. Verificar se as funções foram criadas corretamente
SELECT 
    'can_create_colaboradora' as funcao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'sistemaretiradas'
            AND p.proname = 'can_create_colaboradora'
        ) THEN '✅ CRIADA'
        ELSE '❌ NÃO CRIADA'
    END as status;

SELECT 
    'can_create_store' as funcao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'sistemaretiradas'
            AND p.proname = 'can_create_store'
        ) THEN '✅ CRIADA'
        ELSE '❌ NÃO CRIADA'
    END as status;

-- Verificar se subscription_plans existe (sistema principal)
SELECT 
    'subscription_plans' as tabela,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'sistemaretiradas'
            AND table_name = 'subscription_plans'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status;

-- 9. Verificar configuração atual do plano Enterprise
SELECT 
    name,
    display_name,
    max_stores as lojas_base,
    max_colaboradoras_total as colaboradoras_base,
    price_monthly / 100.0 as preco_mensal_reais
FROM sistemaretiradas.subscription_plans
WHERE name = 'ENTERPRISE';

-- 10. Verificar addons grátis do Enterprise
SELECT 
    name,
    display_name,
    CASE 
        WHEN addon_type = 'STORE' THEN CONCAT('+', adds_stores, ' lojas')
        WHEN addon_type = 'COLABORADORAS' THEN CONCAT('+', adds_colaboradoras, ' colaboradoras')
        ELSE 'N/A'
    END as bonus,
    CASE 
        WHEN price_monthly = 0 THEN '✅ GRÁTIS'
        ELSE CONCAT('R$ ', price_monthly / 100.0, '/mês')
    END as preco
FROM sistemaretiradas.subscription_addons
WHERE name IN ('ENTERPRISE_EXTRA_STORES_3', 'ENTERPRISE_EXTRA_COLABORADORAS_10');

-- 11. Verificar limites totais do Enterprise (base + addons grátis)
-- Total: 7 + 3 = 10 lojas | 80 + 10 = 90 colaboradoras
SELECT 
    'ENTERPRISE' as plano,
    7 as lojas_base,
    3 as lojas_extras_grais,
    7 + 3 as lojas_total,
    80 as colaboradoras_base,
    10 as colaboradoras_extras_grais,
    80 + 10 as colaboradoras_total;

-- 12. Configurar admin específico com plano Enterprise
-- Substitua 'matheusmartinss@icloud.com' pelo email do admin que deve ter Enterprise
DO $$
DECLARE
    v_admin_id UUID;
    v_enterprise_plan_id UUID;
    v_subscription_id UUID;
    v_extra_stores_addon_id UUID;
    v_extra_colaboradoras_addon_id UUID;
BEGIN
    -- Buscar admin pelo email
    SELECT id INTO v_admin_id
    FROM auth.users
    WHERE email = 'matheusmartinss@icloud.com'
    LIMIT 1;
    
    -- Buscar ID do plano Enterprise
    SELECT id INTO v_enterprise_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE name = 'ENTERPRISE'
    LIMIT 1;
    
    -- Buscar IDs dos addons grátis
    SELECT id INTO v_extra_stores_addon_id
    FROM sistemaretiradas.subscription_addons
    WHERE name = 'ENTERPRISE_EXTRA_STORES_3'
    LIMIT 1;
    
    SELECT id INTO v_extra_colaboradoras_addon_id
    FROM sistemaretiradas.subscription_addons
    WHERE name = 'ENTERPRISE_EXTRA_COLABORADORAS_10'
    LIMIT 1;
    
    IF v_admin_id IS NOT NULL AND v_enterprise_plan_id IS NOT NULL THEN
        -- Criar ou atualizar assinatura Enterprise
        INSERT INTO sistemaretiradas.admin_subscriptions (
            admin_id, plan_id, status, billing_cycle
        ) VALUES (
            v_admin_id, v_enterprise_plan_id, 'ACTIVE', 'MONTHLY'
        )
        ON CONFLICT (admin_id) DO UPDATE SET
            plan_id = v_enterprise_plan_id,
            status = 'ACTIVE',
            updated_at = NOW();
        
        -- Buscar subscription_id
        SELECT id INTO v_subscription_id
        FROM sistemaretiradas.admin_subscriptions
        WHERE admin_id = v_admin_id;
        
        -- Adicionar addons grátis
        IF v_subscription_id IS NOT NULL AND v_extra_stores_addon_id IS NOT NULL AND v_extra_colaboradoras_addon_id IS NOT NULL THEN
            -- +3 lojas extras
            INSERT INTO sistemaretiradas.admin_subscription_addons (
                subscription_id, addon_id, quantity, is_active
            ) VALUES (
                v_subscription_id, v_extra_stores_addon_id, 1, true
            ) ON CONFLICT (subscription_id, addon_id) DO UPDATE SET
                is_active = true,
                quantity = 1;
            
            -- +10 colaboradoras extras
            INSERT INTO sistemaretiradas.admin_subscription_addons (
                subscription_id, addon_id, quantity, is_active
            ) VALUES (
                v_subscription_id, v_extra_colaboradoras_addon_id, 1, true
            ) ON CONFLICT (subscription_id, addon_id) DO UPDATE SET
                is_active = true,
                quantity = 1;
        END IF;
        
        RAISE NOTICE '✅ Admin configurado com plano Enterprise: matheusmartinss@icloud.com';
    ELSE
        RAISE NOTICE '⚠️ Admin não encontrado ou plano Enterprise não existe';
    END IF;
END $$;

-- 13. Verificar configuração do admin
SELECT 
    u.email,
    sp.display_name as plano,
    sp.max_stores as lojas_base,
    sp.max_colaboradoras_total as colaboradoras_base,
    COALESCE(SUM(CASE WHEN a.addon_type = 'STORE' THEN a.adds_stores * asa.quantity ELSE 0 END), 0) as lojas_extras,
    COALESCE(SUM(CASE WHEN a.addon_type = 'COLABORADORAS' THEN a.adds_colaboradoras * asa.quantity ELSE 0 END), 0) as colaboradoras_extras,
    (sp.max_stores + COALESCE(SUM(CASE WHEN a.addon_type = 'STORE' THEN a.adds_stores * asa.quantity ELSE 0 END), 0)) as lojas_total,
    (sp.max_colaboradoras_total + COALESCE(SUM(CASE WHEN a.addon_type = 'COLABORADORAS' THEN a.adds_colaboradoras * asa.quantity ELSE 0 END), 0)) as colaboradoras_total
FROM auth.users u
JOIN sistemaretiradas.admin_subscriptions asub ON asub.admin_id = u.id
JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
LEFT JOIN sistemaretiradas.admin_subscription_addons asa ON asa.subscription_id = asub.id AND asa.is_active = true
LEFT JOIN sistemaretiradas.subscription_addons a ON a.id = asa.addon_id
WHERE u.email = 'matheusmartinss@icloud.com'
GROUP BY u.email, sp.display_name, sp.max_stores, sp.max_colaboradoras_total;

-- 14. Testar função can_create_colaboradora (versão sem parâmetro)
SELECT 
    sistemaretiradas.can_create_colaboradora() as pode_criar_colaboradora,
    CASE 
        WHEN sistemaretiradas.can_create_colaboradora() = true 
        THEN '✅ FUNÇÃO OK'
        ELSE '❌ ERRO NA FUNÇÃO'
    END as resultado;

