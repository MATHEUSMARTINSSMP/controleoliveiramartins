-- ============================================================================
-- VERIFICAR PEDIDO ESPECÍFICO SEM VENDA
-- Investigar por que o pedido com colaboradora_id não está criando venda
-- ============================================================================

-- 1. VERIFICAR O PEDIDO PROBLEMÁTICO (com colaboradora mas sem venda)
SELECT 
    '1. PEDIDO SEM VENDA (COM COLABORADORA)' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    t_order.created_at,
    t_order.updated_at,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total IS NULL OR t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '✅ DEVERIA TER VENDA'
    END as status,
    -- Verificar se a colaboradora existe
    c.name as colaboradora_nome,
    c.active as colaboradora_ativa,
    -- Verificar se a loja existe
    st.name as loja_nome,
    st.active as loja_ativa
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE s.id IS NULL
  AND t_order.colaboradora_id IS NOT NULL
  AND t_order.colaboradora_id = '60fffeda-d1ea-4a10-aa0a-1c08ca796b95'
ORDER BY t_order.created_at DESC;

-- 2. VERIFICAR TODOS OS PEDIDOS SEM VENDA (detalhado)
SELECT 
    '2. TODOS OS PEDIDOS SEM VENDA' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total IS NULL OR t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '✅ DEVERIA TER VENDA'
    END as motivo_sem_venda,
    c.name as colaboradora_nome,
    st.name as loja_nome
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE s.id IS NULL
  AND t_order.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY 
    CASE 
        WHEN t_order.colaboradora_id IS NOT NULL AND t_order.valor_total > 0 THEN 1
        ELSE 2
    END,
    t_order.created_at DESC
LIMIT 20;

-- 3. TESTAR CRIAÇÃO DE VENDA PARA O PEDIDO ESPECÍFICO
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(
--     (SELECT store_id FROM sistemaretiradas.tiny_orders WHERE colaboradora_id = '60fffeda-d1ea-4a10-aa0a-1c08ca796b95' AND id NOT IN (SELECT tiny_order_id FROM sistemaretiradas.sales WHERE tiny_order_id IS NOT NULL) LIMIT 1),
--     NULL
-- );

-- 4. VERIFICAR SE HÁ ERRO NA FUNÇÃO (verificar logs)
SELECT 
    '4. VERIFICAR ERROS' as verificacao,
    'Execute a função criar_vendas_de_tiny_orders e verifique os detalhes de erro' as instrucao;

-- 5. VERIFICAR SE O PEDIDO TEM ITENS (necessário para calcular qtd_pecas)
SELECT 
    '5. VERIFICAR ITENS DO PEDIDO' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.itens,
    jsonb_array_length(COALESCE(t_order.itens, '[]'::jsonb)) as qtd_itens,
    CASE 
        WHEN t_order.itens IS NULL THEN '❌ SEM ITENS'
        WHEN jsonb_array_length(COALESCE(t_order.itens, '[]'::jsonb)) = 0 THEN '❌ ARRAY VAZIO'
        ELSE '✅ TEM ITENS'
    END as status_itens
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.colaboradora_id IS NOT NULL
  AND t_order.colaboradora_id = '60fffeda-d1ea-4a10-aa0a-1c08ca796b95'
ORDER BY t_order.created_at DESC;

-- 6. FORÇAR CRIAÇÃO DE VENDAS PARA TODOS OS PEDIDOS SEM VENDA
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

