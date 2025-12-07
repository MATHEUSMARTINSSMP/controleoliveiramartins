-- ============================================================================
-- VERIFICAR: Por que vendas do ERP não aparecem no Dashboard da Loja?
-- Foco: Verificar se as vendas existem e se os filtros estão corretos
-- ============================================================================

-- 1. VERIFICAR VENDAS RECENTES COM TINY_ORDER_ID (últimas 24h)
SELECT 
    '1. VENDAS DO ERP (últimas 24h)' as verificacao,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido as tiny_data_pedido,
    c.name as colaboradora_nome,
    st.name as loja_nome,
    -- Verificar formato da data
    s.data_venda::text as data_venda_texto,
    EXTRACT(HOUR FROM s.data_venda::timestamp) as hora_venda,
    EXTRACT(MINUTE FROM s.data_venda::timestamp) as minuto_venda,
    -- Verificar se a data está no formato esperado pelo frontend
    CASE 
        WHEN s.data_venda::text LIKE '%-%-% %:%:%' THEN '✅ FORMATO COM HORA'
        WHEN s.data_venda::text LIKE '%-%-%' THEN '⚠️ FORMATO SEM HORA'
        ELSE '❌ FORMATO DESCONHECIDO'
    END as formato_data
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON t_order.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.tiny_order_id IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 20;

-- 2. SIMULAR O FILTRO DO FRONTEND (para hoje)
SELECT 
    '2. SIMULAÇÃO DO FILTRO DO FRONTEND (HOJE)' as verificacao,
    s.id,
    s.data_venda,
    s.store_id,
    st.name as loja_nome,
    -- Simular filtro do frontend: .gte('data_venda', '2025-12-01T00:00:00') .lte('data_venda', '2025-12-01T23:59:59')
    CASE 
        WHEN s.data_venda >= (CURRENT_DATE::text || 'T00:00:00')::timestamp 
         AND s.data_venda <= (CURRENT_DATE::text || 'T23:59:59')::timestamp
        THEN '✅ SERIA ENCONTRADO'
        ELSE '❌ NÃO SERIA ENCONTRADO'
    END as resultado_filtro,
    s.data_venda::text as data_venda_formatada,
    (CURRENT_DATE::text || 'T00:00:00')::timestamp as inicio_dia,
    (CURRENT_DATE::text || 'T23:59:59')::timestamp as fim_dia
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.tiny_order_id IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 10;

-- 3. VERIFICAR SE HÁ PROBLEMA COM TIMEZONE
SELECT 
    '3. VERIFICAÇÃO DE TIMEZONE' as verificacao,
    s.id,
    s.data_venda,
    s.data_venda AT TIME ZONE 'UTC' as data_venda_utc,
    s.data_venda AT TIME ZONE 'America/Sao_Paulo' as data_venda_sp,
    CURRENT_DATE as data_atual,
    CURRENT_TIMESTAMP as timestamp_atual,
    NOW() as now_atual
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 5;

-- 4. VERIFICAR VENDAS POR LOJA (últimas 48h)
SELECT 
    '4. VENDAS POR LOJA (48h)' as verificacao,
    st.id as store_id,
    st.name as loja_nome,
    COUNT(*) as total_vendas_erp,
    COUNT(DISTINCT CASE WHEN s.data_venda::date = CURRENT_DATE THEN s.id END) as vendas_hoje,
    MIN(s.data_venda) as primeira_venda,
    MAX(s.data_venda) as ultima_venda
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.tiny_order_id IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY st.id, st.name
ORDER BY total_vendas_erp DESC;

-- 5. VERIFICAR SE AS VENDAS ESTÃO COM DATA_VENDA CORRETA
SELECT 
    '5. VERIFICAÇÃO DE DATA_VENDA' as verificacao,
    s.id,
    s.data_venda,
    t_order.data_pedido,
    CASE 
        WHEN s.data_venda::date = t_order.data_pedido::date THEN '✅ DATAS BATEM'
        ELSE '❌ DATAS NÃO BATEM'
    END as comparacao_datas,
    s.data_venda::date as sale_date,
    t_order.data_pedido::date as tiny_date
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON t_order.id = s.tiny_order_id
WHERE s.tiny_order_id IS NOT NULL
  AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 10;

