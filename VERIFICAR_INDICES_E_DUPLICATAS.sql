-- ============================================================================
-- Query para verificar índices únicos e duplicatas de vendas
-- ============================================================================

-- 1. Verificar índices únicos em tiny_order_id
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'sales'
  AND indexdef LIKE '%tiny_order_id%'
ORDER BY indexname;

-- 2. Verificar se há vendas duplicadas por tiny_order_id
SELECT 
    tiny_order_id,
    COUNT(*) as quantidade_vendas,
    STRING_AGG(id::TEXT, ', ' ORDER BY created_at) as sale_ids,
    STRING_AGG(valor::TEXT, ', ' ORDER BY created_at) as valores,
    STRING_AGG(data_venda::TEXT, ', ' ORDER BY created_at) as datas,
    STRING_AGG(created_at::TEXT, ', ' ORDER BY created_at) as created_ats
FROM sistemaretiradas.sales
WHERE tiny_order_id IS NOT NULL
GROUP BY tiny_order_id
HAVING COUNT(*) > 1
ORDER BY quantidade_vendas DESC, tiny_order_id;

-- 3. Se houver duplicatas, mostrar detalhes completos
WITH duplicatas AS (
    SELECT 
        tiny_order_id,
        COUNT(*) as quantidade
    FROM sistemaretiradas.sales
    WHERE tiny_order_id IS NOT NULL
    GROUP BY tiny_order_id
    HAVING COUNT(*) > 1
)
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.valor,
    s.data_venda,
    s.colaboradora_id,
    s.created_at,
    s.updated_at,
    t_order.numero_pedido,
    t_order.data_pedido as tiny_order_data
FROM sistemaretiradas.sales s
INNER JOIN duplicatas d ON s.tiny_order_id = d.tiny_order_id
LEFT JOIN sistemaretiradas.tiny_orders t_order ON s.tiny_order_id = t_order.id
ORDER BY s.tiny_order_id, s.created_at;

-- 4. Verificar constraint UNIQUE (se houver)
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.sales'::regclass
  AND (conname LIKE '%tiny_order%' OR contype = 'u')
ORDER BY conname;

-- 5. Verificar todas as vendas com tiny_order_id (últimas 50)
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.valor,
    s.data_venda,
    s.created_at,
    t_order.numero_pedido,
    t_order.valor_total as tiny_order_valor,
    t_order.data_pedido as tiny_order_data
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON s.tiny_order_id = t_order.id
WHERE s.tiny_order_id IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 50;

