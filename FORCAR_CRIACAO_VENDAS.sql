-- ============================================================================
-- FORÇAR CRIAÇÃO DE VENDAS A PARTIR DE PEDIDOS DO TINY
-- Execute este script para criar vendas que não foram criadas automaticamente
-- ============================================================================

-- 1. VERIFICAR PEDIDOS SEM VENDA ANTES DE EXECUTAR
SELECT 
    'ANTES: Pedidos sem venda' as status,
    COUNT(*) as total,
    SUM(CASE WHEN colaboradora_id IS NULL THEN 1 ELSE 0 END) as sem_colaboradora,
    SUM(CASE WHEN valor_total <= 0 THEN 1 ELSE 0 END) as valor_zero,
    SUM(CASE WHEN colaboradora_id IS NOT NULL AND valor_total > 0 THEN 1 ELSE 0 END) as prontos_para_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL;

-- 2. EXECUTAR FUNÇÃO PARA CRIAR VENDAS
-- ⚠️ ATENÇÃO: Esta função processa TODOS os pedidos sem venda
SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

-- 3. VERIFICAR RESULTADO APÓS EXECUTAR
SELECT 
    'DEPOIS: Pedidos sem venda' as status,
    COUNT(*) as total,
    SUM(CASE WHEN colaboradora_id IS NULL THEN 1 ELSE 0 END) as sem_colaboradora,
    SUM(CASE WHEN valor_total <= 0 THEN 1 ELSE 0 END) as valor_zero,
    SUM(CASE WHEN colaboradora_id IS NOT NULL AND valor_total > 0 THEN 1 ELSE 0 END) as prontos_para_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL;

-- 4. VERIFICAR VENDAS RECENTES CRIADAS
SELECT 
    'VENDAS RECENTES CRIADAS' as status,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    t_order.numero_pedido,
    c.name as colaboradora_nome,
    st.name as loja_nome
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON t_order.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.created_at >= NOW() - INTERVAL '1 hour'
  AND s.tiny_order_id IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 20;

-- 5. VERIFICAR PEDIDOS QUE AINDA NÃO TÊM VENDA (com detalhes)
SELECT 
    'PEDIDOS SEM VENDA (DETALHES)' as status,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    t_order.created_at,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA'
        WHEN t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '✅ PRONTO PARA VENDA'
    END as motivo_sem_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY t_order.created_at DESC
LIMIT 20;

