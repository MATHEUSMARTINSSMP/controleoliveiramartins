-- ============================================================================
-- DIAGNÓSTICO: Por que um pedido não está criando venda automaticamente?
-- Este script NÃO força criação, apenas diagnostica o problema
-- ============================================================================

-- 1. VERIFICAR SE O PEDIDO ATENDE TODOS OS CRITÉRIOS DA FUNÇÃO
SELECT 
    '1. VERIFICAÇÃO DE CRITÉRIOS' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    -- Verificar cada critério
    CASE WHEN t_order.colaboradora_id IS NULL THEN '❌ FALTA' ELSE '✅ OK' END as tem_colaboradora,
    CASE WHEN t_order.store_id IS NULL THEN '❌ FALTA' ELSE '✅ OK' END as tem_store_id,
    CASE WHEN t_order.valor_total IS NULL OR t_order.valor_total <= 0 THEN '❌ FALTA OU ZERO' ELSE '✅ OK' END as tem_valor,
    CASE WHEN EXISTS (SELECT 1 FROM sistemaretiradas.sales s WHERE s.tiny_order_id = t_order.id) THEN '✅ JÁ TEM' ELSE '❌ NÃO TEM' END as tem_venda,
    -- Verificar se colaboradora existe e está ativa
    c.name as colaboradora_nome,
    c.active as colaboradora_ativa,
    CASE WHEN c.id IS NULL THEN '❌ NÃO EXISTE' WHEN NOT c.active THEN '❌ INATIVA' ELSE '✅ OK' END as status_colaboradora,
    -- Verificar se loja existe e está ativa
    st.name as loja_nome,
    st.active as loja_ativa,
    CASE WHEN st.id IS NULL THEN '❌ NÃO EXISTE' WHEN NOT st.active THEN '❌ INATIVA' ELSE '✅ OK' END as status_loja
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE t_order.numero_pedido = '1419'
   OR t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb';

-- 2. VERIFICAR SE O PEDIDO SERIA ENCONTRADO PELA FUNÇÃO (simular WHERE clause)
SELECT 
    '2. SIMULAÇÃO DA QUERY DA FUNÇÃO' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    -- Verificar cada condição do WHERE
    CASE WHEN (NULL IS NULL OR t_order.store_id = NULL) THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_store_id,
    CASE WHEN (NULL IS NULL OR t_order.data_pedido >= NULL) THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_data,
    CASE WHEN t_order.colaboradora_id IS NOT NULL THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_colaboradora,
    CASE WHEN t_order.store_id IS NOT NULL THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_store_not_null,
    CASE WHEN t_order.valor_total > 0 THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_valor,
    CASE WHEN s.id IS NULL OR (t_order.updated_at > s.updated_at) THEN '✅ PASSA' ELSE '❌ BLOQUEADO' END as filtro_sem_venda,
    -- Resultado final
    CASE 
        WHEN (NULL IS NULL OR t_order.store_id = NULL)
         AND (NULL IS NULL OR t_order.data_pedido >= NULL)
         AND t_order.colaboradora_id IS NOT NULL
         AND t_order.store_id IS NOT NULL
         AND t_order.valor_total > 0
         AND (s.id IS NULL OR (t_order.updated_at > s.updated_at))
        THEN '✅ SERIA PROCESSADO'
        ELSE '❌ NÃO SERIA PROCESSADO'
    END as resultado_final
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.numero_pedido = '1419'
   OR t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb';

-- 3. VERIFICAR ÚLTIMA EXECUÇÃO DA FUNÇÃO (se houver logs)
SELECT 
    '3. VERIFICAR LOGS' as verificacao,
    'Verifique os logs da função sync-tiny-orders-background na Netlify para ver se criar_vendas_de_tiny_orders foi chamada' as instrucao;

-- 4. TESTAR A FUNÇÃO MANUALMENTE (apenas para ver o resultado, não força criação)
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(
--     (SELECT store_id FROM sistemaretiradas.tiny_orders WHERE numero_pedido = '1419' LIMIT 1),
--     NULL
-- );

-- 5. VERIFICAR SE HÁ PROBLEMA COM TIMING (pedido criado muito recentemente)
SELECT 
    '5. VERIFICAÇÃO DE TIMING' as verificacao,
    t_order.id,
    t_order.numero_pedido,
    t_order.created_at,
    t_order.updated_at,
    NOW() as agora,
    EXTRACT(EPOCH FROM (NOW() - t_order.created_at)) as segundos_desde_criacao,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - t_order.created_at)) < 2 THEN '⚠️ MUITO RECENTE (pode não ter sido commitado ainda)'
        ELSE '✅ OK'
    END as status_timing
FROM sistemaretiradas.tiny_orders t_order
WHERE t_order.numero_pedido = '1419'
   OR t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb';

