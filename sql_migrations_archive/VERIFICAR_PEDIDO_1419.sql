-- ============================================================================
-- VERIFICAR PEDIDO 1419 ESPECIFICAMENTE
-- Pedido que tem itens mas não está criando venda
-- ============================================================================

-- 1. VERIFICAR TODOS OS DADOS DO PEDIDO 1419
SELECT 
    '1. DADOS COMPLETOS DO PEDIDO 1419' as verificacao,
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    t_order.created_at,
    t_order.updated_at,
    t_order.itens,
    jsonb_array_length(COALESCE(t_order.itens, '[]'::jsonb)) as qtd_itens,
    -- Verificar se tem venda
    s.id as sale_id,
    s.data_venda as sale_data_venda,
    s.valor as sale_valor,
    -- Verificar colaboradora
    c.name as colaboradora_nome,
    c.active as colaboradora_ativa,
    -- Verificar loja
    st.name as loja_nome,
    st.active as loja_ativa,
    -- Status
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ JÁ TEM VENDA'
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total IS NULL OR t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        WHEN c.id IS NULL THEN '❌ COLABORADORA NÃO EXISTE'
        WHEN st.id IS NULL THEN '❌ LOJA NÃO EXISTE'
        WHEN NOT c.active THEN '❌ COLABORADORA INATIVA'
        WHEN NOT st.active THEN '❌ LOJA INATIVA'
        ELSE '✅ DEVERIA TER VENDA'
    END as status
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE t_order.numero_pedido = '1419'
   OR t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb';

-- 2. TESTAR CRIAÇÃO DE VENDA APENAS PARA ESTE PEDIDO
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(
--     (SELECT store_id FROM sistemaretiradas.tiny_orders WHERE id = '91f7122c-a11f-436b-8179-a95f80a8e2eb'),
--     NULL
-- );

-- 3. VERIFICAR SE A FUNÇÃO ESTÁ SENDO CHAMADA CORRETAMENTE
SELECT 
    '3. TESTE MANUAL DA FUNÇÃO' as verificacao,
    'Execute: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);' as instrucao;

-- 4. VERIFICAR SE HÁ ALGUM ERRO NA TABELA DE LOGS (se existir)
SELECT 
    '4. VERIFICAR LOGS' as verificacao,
    'Verifique os logs da função sync-tiny-orders-background na Netlify' as instrucao;

-- 5. FORÇAR CRIAÇÃO DE VENDA MANUALMENTE (INSERT DIRETO)
-- ⚠️ ATENÇÃO: Use apenas se a função não funcionar
/*
INSERT INTO sistemaretiradas.sales (
    tiny_order_id,
    colaboradora_id,
    store_id,
    valor,
    qtd_pecas,
    data_venda,
    observacoes,
    lancado_por_id
)
SELECT 
    t_order.id,
    t_order.colaboradora_id,
    t_order.store_id,
    t_order.valor_total,
    COALESCE(
        (SELECT SUM((item->>'quantidade')::INTEGER)
         FROM jsonb_array_elements(t_order.itens) AS item
         WHERE (item->>'quantidade') IS NOT NULL),
        1
    ),
    t_order.data_pedido,
    COALESCE(t_order.observacoes || ' | ', '') || 'Pedido Tiny: #' || t_order.numero_pedido,
    NULL
FROM sistemaretiradas.tiny_orders t_order
WHERE t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb'
  AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.sales s 
      WHERE s.tiny_order_id = t_order.id
  )
ON CONFLICT (tiny_order_id) DO NOTHING
RETURNING *;
*/

