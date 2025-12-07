-- ============================================================================
-- DIAGNÓSTICO: Vendas do ERP não aparecem no Dashboard da Loja
-- Execute este script para verificar o problema
-- ============================================================================

-- 1. VERIFICAR PEDIDOS DO TINY QUE TÊM VENDA CRIADA
SELECT 
    '1. PEDIDOS TINY COM VENDA' as verificacao,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    s.id as sale_id,
    s.data_venda,
    s.valor as sale_valor,
    s.colaboradora_id as sale_colaboradora_id,
    t_order.colaboradora_id as tiny_colaboradora_id,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ TEM VENDA'
        ELSE '❌ SEM VENDA'
    END as status
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY t_order.created_at DESC
LIMIT 20;

-- 2. VERIFICAR PEDIDOS DO TINY SEM VENDA (que deveriam ter)
SELECT 
    '2. PEDIDOS TINY SEM VENDA' as verificacao,
    COUNT(*) as total_sem_venda,
    SUM(CASE WHEN t_order.colaboradora_id IS NULL THEN 1 ELSE 0 END) as sem_colaboradora,
    SUM(CASE WHEN t_order.valor_total <= 0 THEN 1 ELSE 0 END) as valor_zero_ou_negativo,
    SUM(CASE WHEN t_order.colaboradora_id IS NOT NULL AND t_order.valor_total > 0 THEN 1 ELSE 0 END) as deveria_ter_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.created_at >= NOW() - INTERVAL '48 hours';

-- 3. VERIFICAR VENDAS RECENTES NO DASHBOARD DA LOJA
SELECT 
    '3. VENDAS RECENTES (SALES)' as verificacao,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    c.name as colaboradora_nome,
    st.name as loja_nome,
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN '✅ VIA ERP'
        ELSE '📝 MANUAL'
    END as origem
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY s.created_at DESC
LIMIT 20;

-- 4. VERIFICAR SE A FUNÇÃO criar_vendas_de_tiny_orders ESTÁ SENDO CHAMADA
SELECT 
    '4. ÚLTIMAS EXECUÇÕES DA FUNÇÃO' as verificacao,
    'Execute manualmente: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);' as instrucao;

-- 5. VERIFICAR PEDIDOS ESPECÍFICOS (último pedido do ERP)
SELECT 
    '5. ÚLTIMO PEDIDO DO ERP' as verificacao,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    t_order.created_at,
    s.id as tem_venda,
    s.data_venda as data_venda_sale
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
ORDER BY t_order.created_at DESC
LIMIT 5;

-- 6. TESTAR CRIAÇÃO DE VENDAS MANUALMENTE
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

-- 7. VERIFICAR SE HÁ PROBLEMA COM STORE_ID
SELECT 
    '7. VERIFICAÇÃO DE STORE_ID' as verificacao,
    t_order.store_id as tiny_store_id,
    s.store_id as sale_store_id,
    COUNT(*) as total,
    COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.id END) as com_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY t_order.store_id, s.store_id
ORDER BY total DESC;

-- 8. VERIFICAR SE HÁ PROBLEMA COM COLABORADORA_ID
SELECT 
    '8. VERIFICAÇÃO DE COLABORADORA_ID' as verificacao,
    t_order.colaboradora_id as tiny_colaboradora_id,
    s.colaboradora_id as sale_colaboradora_id,
    COUNT(*) as total,
    COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.id END) as com_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY t_order.colaboradora_id, s.colaboradora_id
ORDER BY total DESC;

