-- ============================================================================
-- ✅ INSERIR CONFIGURAÇÃO PADRÃO DE CASHBACK
-- ============================================================================
-- Execute esta query no Supabase SQL Editor para criar as configurações padrão

-- 1. Configuração GLOBAL (válida para todas as lojas sem configuração específica)
INSERT INTO sistemaretiradas.cashback_settings (
    store_id,
    prazo_liberacao_dias,
    prazo_expiracao_dias,
    percentual_cashback,
    percentual_uso_maximo,
    renovacao_habilitada,
    renovacao_dias,
    observacoes
)
SELECT 
    NULL, -- Configuração global
    2,    -- Liberação em 2 dias após a compra
    30,   -- Expiração em 30 dias após liberação
    15.00, -- 15% de cashback
    30.00, -- Máximo 30% do valor da compra pode ser pago com cashback
    true,  -- Renovação habilitada
    3,     -- Renovar por mais 3 dias quando expirar
    'Configuração padrão global de cashback'
WHERE NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.cashback_settings 
    WHERE store_id IS NULL
)
ON CONFLICT (store_id) DO NOTHING;

-- 2. Verificar configurações criadas
SELECT 
    COALESCE(s.name, 'GLOBAL') as store_name,
    cs.percentual_cashback,
    cs.prazo_liberacao_dias,
    cs.prazo_expiracao_dias,
    cs.renovacao_habilitada
FROM sistemaretiradas.cashback_settings cs
LEFT JOIN sistemaretiradas.stores s ON cs.store_id = s.id
ORDER BY s.name NULLS FIRST;

-- ============================================================================
-- IMPORTANTE: Após inserir as configurações, você precisará:
-- 1. Re-sincronizar os pedidos OU
-- 2. Executar manualmente a função gerar_cashback para pedidos existentes
-- ============================================================================

