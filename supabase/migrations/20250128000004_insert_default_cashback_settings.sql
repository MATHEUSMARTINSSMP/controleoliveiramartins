-- ============================================================================
-- INSERIR CONFIGURAÇÃO PADRÃO DE CASHBACK
-- ============================================================================
-- Este script insere configurações padrão de cashback para todas as lojas
-- Se já existir configuração global, não insere novamente

-- 1. Inserir configuração GLOBAL (válida para todas as lojas que não têm configuração específica)
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

-- 2. Inserir configuração específica para cada loja ativa (se não tiver configuração)
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
    s.id,
    2,    -- Liberação em 2 dias após a compra
    30,   -- Expiração em 30 dias após liberação
    15.00, -- 15% de cashback
    30.00, -- Máximo 30% do valor da compra pode ser pago com cashback
    true,  -- Renovação habilitada
    3,     -- Renovar por mais 3 dias quando expirar
    'Configuração padrão de cashback para ' || s.name
FROM sistemaretiradas.stores s
WHERE s.active = true
  AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.cashback_settings cs
      WHERE cs.store_id = s.id
  );

-- 3. Verificar configurações criadas
SELECT 
    s.name as store_name,
    COALESCE(cs.store_id::text, 'GLOBAL') as config_type,
    cs.percentual_cashback,
    cs.prazo_liberacao_dias,
    cs.prazo_expiracao_dias,
    cs.renovacao_habilitada
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.cashback_settings cs ON (
    cs.store_id = s.id 
    OR (cs.store_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_settings cs2 
        WHERE cs2.store_id = s.id
    ))
)
WHERE s.active = true
ORDER BY s.name, cs.store_id NULLS FIRST;

