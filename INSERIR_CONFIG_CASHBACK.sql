-- ============================================================================
-- ✅ INSERIR CONFIGURAÇÃO PADRÃO DE CASHBACK - EXECUTE ESTA QUERY
-- ============================================================================

-- 1️⃣ Configuração GLOBAL (válida para todas as lojas sem configuração específica)
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
);

-- 2️⃣ Verificar se foi criado
SELECT 
    '✅ Configuração criada!' as status,
    COALESCE(s.name, 'GLOBAL') as store_name,
    cs.percentual_cashback || '%' as cashback,
    cs.prazo_liberacao_dias || ' dias' as liberacao,
    cs.prazo_expiracao_dias || ' dias' as expiracao
FROM sistemaretiradas.cashback_settings cs
LEFT JOIN sistemaretiradas.stores s ON cs.store_id = s.id
WHERE cs.store_id IS NULL;

