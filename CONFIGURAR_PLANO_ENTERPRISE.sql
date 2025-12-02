-- ============================================================================
-- CONFIGURAR PLANO ENTERPRISE (SEM LIMITES)
-- ============================================================================
-- Este script configura o sistema para funcionar como Enterprise (sem limites)
-- Remove ou desabilita verificações de limites do plano

-- 1. Criar/Atualizar função RPC que sempre permite criar colaboradoras
-- ✅ VERSÃO SEM PARÂMETRO (para compatibilidade com Netlify Function)
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_colaboradora()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ✅ PLANO ENTERPRISE: Sempre retorna true (sem limites)
    RETURN true;
END;
$$;

-- ✅ VERSÃO COM PARÂMETRO (para compatibilidade com StoreManagement)
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_colaboradora(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    -- ✅ PLANO ENTERPRISE: Sempre retorna true (sem limites)
    RETURN true;
END;
$$;

-- 2. Criar/Atualizar função RPC que sempre permite criar lojas
CREATE OR REPLACE FUNCTION sistemaretiradas.can_create_store(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    -- ✅ PLANO ENTERPRISE: Sempre retorna true (sem limites)
    RETURN true;
END;
$$;

-- 3. Criar tabela de configuração do plano (se não existir)
CREATE TABLE IF NOT EXISTS sistemaretiradas.plan_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_type TEXT NOT NULL DEFAULT 'ENTERPRISE',
    max_stores INTEGER DEFAULT NULL, -- NULL = sem limite
    max_colaboradoras_per_store INTEGER DEFAULT NULL, -- NULL = sem limite
    max_colaboradoras_total INTEGER DEFAULT NULL, -- NULL = sem limite
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(plan_type)
);

-- 4. Inserir/Atualizar configuração Enterprise
INSERT INTO sistemaretiradas.plan_config (plan_type, max_stores, max_colaboradoras_per_store, max_colaboradoras_total)
VALUES ('ENTERPRISE', NULL, NULL, NULL)
ON CONFLICT (plan_type) 
DO UPDATE SET
    max_stores = NULL,
    max_colaboradoras_per_store = NULL,
    max_colaboradoras_total = NULL,
    updated_at = NOW();

-- 5. Criar função helper para verificar limites (sempre retorna true para Enterprise)
CREATE OR REPLACE FUNCTION sistemaretiradas.check_plan_limits(
    p_limit_type TEXT -- 'stores', 'colaboradoras_per_store', 'colaboradoras_total'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_config sistemaretiradas.plan_config%ROWTYPE;
    v_limit INTEGER;
BEGIN
    -- Buscar configuração do plano
    SELECT * INTO v_plan_config
    FROM sistemaretiradas.plan_config
    WHERE plan_type = 'ENTERPRISE'
    LIMIT 1;
    
    -- Se não encontrar configuração, assumir Enterprise (sem limites)
    IF NOT FOUND THEN
        RETURN true;
    END IF;
    
    -- Se for Enterprise, sempre permitir
    IF v_plan_config.plan_type = 'ENTERPRISE' THEN
        RETURN true;
    END IF;
    
    -- Para outros planos, verificar limites específicos
    CASE p_limit_type
        WHEN 'stores' THEN
            v_limit := v_plan_config.max_stores;
        WHEN 'colaboradoras_per_store' THEN
            v_limit := v_plan_config.max_colaboradoras_per_store;
        WHEN 'colaboradoras_total' THEN
            v_limit := v_plan_config.max_colaboradoras_total;
        ELSE
            RETURN true; -- Tipo desconhecido, permitir por segurança
    END CASE;
    
    -- Se limite for NULL, significa sem limite
    IF v_limit IS NULL THEN
        RETURN true;
    END IF;
    
    -- Aqui você pode adicionar lógica para contar e comparar com o limite
    -- Por enquanto, sempre retorna true para Enterprise
    RETURN true;
END;
$$;

-- 6. Verificar se as funções foram criadas corretamente
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

SELECT 
    'plan_config' as tabela,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'sistemaretiradas'
            AND table_name = 'plan_config'
        ) THEN '✅ CRIADA'
        ELSE '❌ NÃO CRIADA'
    END as status;

-- 7. Verificar configuração atual
SELECT 
    plan_type,
    max_stores,
    max_colaboradoras_per_store,
    max_colaboradoras_total,
    CASE 
        WHEN max_stores IS NULL 
            AND max_colaboradoras_per_store IS NULL 
            AND max_colaboradoras_total IS NULL 
        THEN '✅ PLANO ENTERPRISE (SEM LIMITES)'
        ELSE '⚠️ PLANO COM LIMITES'
    END as status
FROM sistemaretiradas.plan_config
WHERE plan_type = 'ENTERPRISE';

-- 8. Testar função can_create_colaboradora
SELECT 
    sistemaretiradas.can_create_colaboradora() as pode_criar_colaboradora,
    CASE 
        WHEN sistemaretiradas.can_create_colaboradora() = true 
        THEN '✅ SEM LIMITES (ENTERPRISE)'
        ELSE '❌ COM LIMITES'
    END as resultado;

