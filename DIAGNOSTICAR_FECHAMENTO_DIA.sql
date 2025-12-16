-- ============================================================================
-- DIAGNÓSTICO: FECHAMENTO DO DIA ESTÁ ERRADO
-- ============================================================================
-- Este script verifica por que o fechamento mostra R$ 0,00 quando há vendas
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR VENDAS DE HOJE (15/12/2025)
-- ============================================================================
SELECT 
    '1. Vendas de hoje (15/12/2025)' as verificacao,
    COUNT(*) as total_vendas,
    SUM(valor) as total_valor,
    MIN(data_venda) as primeira_venda,
    MAX(data_venda) as ultima_venda
FROM sistemaretiradas.sales
WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND data_venda >= '2025-12-15T00:00:00'
  AND data_venda < '2025-12-16T00:00:00';

-- ============================================================================
-- 2. VERIFICAR VENDAS POR COLABORADORA HOJE
-- ============================================================================
SELECT 
    '2. Vendas por colaboradora hoje' as verificacao,
    p.name as colaboradora,
    COUNT(s.id) as qtd_vendas,
    SUM(s.valor) as total_vendido,
    MIN(s.data_venda) as primeira_venda,
    MAX(s.data_venda) as ultima_venda
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND s.data_venda >= '2025-12-15T00:00:00'
  AND s.data_venda < '2025-12-16T00:00:00'
GROUP BY p.id, p.name
ORDER BY total_vendido DESC;

-- ============================================================================
-- 3. VERIFICAR ÚLTIMO FECHAMENTO REGISTRADO
-- ============================================================================
SELECT 
    '3. Último fechamento registrado' as verificacao,
    id,
    tipo,
    data_operacao,
    dinheiro_caixa,
    vendido_dia,
    vendido_mes,
    meta_dia,
    meta_mes,
    falta_mes,
    observacoes
FROM sistemaretiradas.caixa_operacoes
WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND tipo = 'FECHAMENTO'
ORDER BY data_operacao DESC
LIMIT 5;

-- ============================================================================
-- 4. COMPARAR: VENDAS REAIS vs FECHAMENTO REGISTRADO
-- ============================================================================
WITH vendas_hoje AS (
    SELECT 
        SUM(valor) as total_vendido_real,
        COUNT(*) as qtd_vendas_real
    FROM sistemaretiradas.sales
    WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
      AND data_venda >= '2025-12-15T00:00:00'
      AND data_venda < '2025-12-16T00:00:00'
),
fechamento_hoje AS (
    SELECT 
        vendido_dia,
        data_operacao
    FROM sistemaretiradas.caixa_operacoes
    WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
      AND tipo = 'FECHAMENTO'
      AND data_operacao >= '2025-12-15T00:00:00'
      AND data_operacao < '2025-12-16T00:00:00'
    ORDER BY data_operacao DESC
    LIMIT 1
)
SELECT 
    '4. Comparação: Real vs Fechamento' as verificacao,
    v.total_vendido_real as vendido_real,
    v.qtd_vendas_real,
    f.vendido_dia as vendido_no_fechamento,
    f.data_operacao as quando_fechou,
    (v.total_vendido_real - COALESCE(f.vendido_dia, 0)) as diferenca
FROM vendas_hoje v
CROSS JOIN fechamento_hoje f;

-- ============================================================================
-- 5. VERIFICAR TIMEZONE DAS VENDAS
-- ============================================================================
SELECT 
    '5. Timezone das vendas' as verificacao,
    id,
    data_venda,
    data_venda AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as data_venda_brasil,
    valor,
    colaboradora_id
FROM sistemaretiradas.sales
WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND data_venda >= '2025-12-15T00:00:00'
  AND data_venda < '2025-12-16T00:00:00'
ORDER BY data_venda DESC
LIMIT 10;

-- ============================================================================
-- 6. VERIFICAR SE HÁ VENDAS COM DATA ERRADA (futuro ou passado)
-- ============================================================================
SELECT 
    '6. Vendas com data suspeita' as verificacao,
    COUNT(*) FILTER (WHERE data_venda > NOW()) as vendas_futuro,
    COUNT(*) FILTER (WHERE data_venda < NOW() - INTERVAL '2 days') as vendas_antigas,
    COUNT(*) FILTER (WHERE data_venda::date = CURRENT_DATE) as vendas_hoje_utc,
    COUNT(*) FILTER (WHERE (data_venda AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = CURRENT_DATE) as vendas_hoje_brasil
FROM sistemaretiradas.sales
WHERE store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND data_venda >= '2025-12-14T00:00:00'
  AND data_venda < '2025-12-16T00:00:00';

-- ============================================================================
-- 7. VERIFICAR COLABORADORAS E SUAS VENDAS HOJE
-- ============================================================================
SELECT 
    '7. Colaboradoras e vendas hoje' as verificacao,
    p.id,
    p.name,
    p.is_active,
    COUNT(s.id) as qtd_vendas_hoje,
    COALESCE(SUM(s.valor), 0) as total_vendido_hoje
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.sales s ON s.colaboradora_id = p.id
    AND s.data_venda >= '2025-12-15T00:00:00'
    AND s.data_venda < '2025-12-16T00:00:00'
    AND s.store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
WHERE p.store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%loungerie%' LIMIT 1)
  AND p.role = 'COLABORADORA'
GROUP BY p.id, p.name, p.is_active
ORDER BY total_vendido_hoje DESC;

