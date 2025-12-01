-- ============================================================================
-- DIAGNÓSTICO COMPLETO: Por que vendas do ERP não aparecem no Dashboard da Loja?
-- Execute este script para identificar o problema
-- ============================================================================

-- 1. VERIFICAR PEDIDOS RECENTES DO TINY (últimas 24h)
SELECT 
    '1. PEDIDOS RECENTES DO TINY (24h)' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    t_order.created_at,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ TEM VENDA'
        ELSE '❌ SEM VENDA'
    END as status_venda,
    s.id as sale_id,
    s.data_venda as sale_data_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY t_order.created_at DESC
LIMIT 20;

-- 2. VERIFICAR PEDIDOS QUE DEVERIAM TER VENDA MAS NÃO TÊM
SELECT 
    '2. PEDIDOS SEM VENDA (QUE DEVERIAM TER)' as verificacao,
    COUNT(*) as total,
    COUNT(DISTINCT t_order.store_id) as lojas_afetadas,
    MIN(t_order.created_at) as primeiro_pedido,
    MAX(t_order.created_at) as ultimo_pedido
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.colaboradora_id IS NOT NULL
  AND t_order.store_id IS NOT NULL
  AND t_order.valor_total > 0
  AND t_order.created_at >= NOW() - INTERVAL '48 hours';

-- 3. TESTAR A FUNÇÃO MANUALMENTE E VER O RESULTADO
SELECT 
    '3. RESULTADO DA FUNÇÃO criar_vendas_de_tiny_orders' as verificacao,
    result.vendas_criadas,
    result.vendas_atualizadas,
    result.erros,
    jsonb_array_length(result.detalhes) as total_detalhes,
    result.detalhes
FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL) as result;

-- 4. VERIFICAR VENDAS RECENTES CRIADAS (últimas 2 horas)
SELECT 
    '4. VENDAS RECENTES CRIADAS (2h)' as verificacao,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    t_order.numero_pedido,
    c.name as colaboradora_nome,
    st.name as loja_nome,
    s.created_at
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON t_order.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.created_at >= NOW() - INTERVAL '2 hours'
  AND s.tiny_order_id IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 20;

-- 5. VERIFICAR SE HÁ PROBLEMA COM STORE_ID (pedidos sem loja correta)
SELECT 
    '5. VERIFICAÇÃO DE STORE_ID' as verificacao,
    t_order.store_id,
    st.name as loja_nome,
    COUNT(*) as total_pedidos,
    COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.id END) as com_venda,
    COUNT(DISTINCT CASE WHEN s.id IS NULL AND t_order.colaboradora_id IS NOT NULL AND t_order.valor_total > 0 THEN t_order.id END) as sem_venda_mas_deveria_ter
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE t_order.created_at >= NOW() - INTERVAL '48 hours'
GROUP BY t_order.store_id, st.name
ORDER BY total_pedidos DESC;

-- 6. VERIFICAR SE A FUNÇÃO ESTÁ SENDO CHAMADA (verificar logs da Netlify)
SELECT 
    '6. VERIFICAR LOGS' as verificacao,
    'Verifique os logs da função sync-tiny-orders-background na Netlify para ver se criar_vendas_de_tiny_orders foi chamada e qual foi o resultado' as instrucao;

-- 7. VERIFICAR PEDIDOS ESPECÍFICOS SEM VENDA (com todos os dados)
SELECT 
    '7. PEDIDOS SEM VENDA (DETALHADO)' as verificacao,
    t_order.id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    c.name as colaboradora_nome,
    c.active as colaboradora_ativa,
    st.name as loja_nome,
    st.active as loja_ativa,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        WHEN c.id IS NULL THEN '❌ COLABORADORA NÃO EXISTE'
        WHEN st.id IS NULL THEN '❌ LOJA NÃO EXISTE'
        WHEN NOT c.active THEN '❌ COLABORADORA INATIVA'
        WHEN NOT st.active THEN '❌ LOJA INATIVA'
        ELSE '✅ DEVERIA TER VENDA'
    END as motivo_sem_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE s.id IS NULL
  AND t_order.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY t_order.created_at DESC
LIMIT 10;

