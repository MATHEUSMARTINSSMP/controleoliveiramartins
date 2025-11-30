-- ============================================================================
-- Query para verificar se há vendas duplicadas (mesmo tiny_order_id)
-- ============================================================================

-- Verificar se há vendas duplicadas por tiny_order_id
SELECT 
    tiny_order_id,
    COUNT(*) as quantidade_vendas,
    STRING_AGG(id::TEXT, ', ' ORDER BY created_at) as sale_ids,
    STRING_AGG(valor::TEXT, ', ') as valores,
    STRING_AGG(data_venda::TEXT, ', ') as datas
FROM sistemaretiradas.sales
WHERE tiny_order_id IS NOT NULL
GROUP BY tiny_order_id
HAVING COUNT(*) > 1
ORDER BY quantidade_vendas DESC;

-- Verificar todas as vendas que têm tiny_order_id
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.valor,
    s.data_venda,
    s.colaboradora_id,
    s.created_at,
    to.numero_pedido,
    to.valor_total as tiny_order_valor,
    to.data_pedido as tiny_order_data
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders to ON s.tiny_order_id = to.id
WHERE s.tiny_order_id IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 50;

-- Verificar se há tiny_orders sem venda correspondente
SELECT 
    to.id as tiny_order_id,
    to.numero_pedido,
    to.valor_total,
    to.data_pedido,
    to.colaboradora_id,
    CASE 
        WHEN s.id IS NULL THEN 'SEM VENDA'
        ELSE 'TEM VENDA'
    END as status
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = to.id
WHERE to.colaboradora_id IS NOT NULL
  AND to.valor_total > 0
ORDER BY to.data_pedido DESC
LIMIT 50;

-- Verificar constraint UNIQUE em tiny_order_id
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.sales'::regclass
  AND conname LIKE '%tiny_order%';

-- Verificar índices únicos em tiny_order_id
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'sales'
  AND indexdef LIKE '%tiny_order_id%';
