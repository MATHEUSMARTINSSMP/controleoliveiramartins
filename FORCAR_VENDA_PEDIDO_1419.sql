-- ============================================================================
-- FORÇAR CRIAÇÃO DE VENDA PARA O PEDIDO 1419
-- Execute este script para criar a venda manualmente
-- ============================================================================

-- 1. VERIFICAR DADOS ANTES DE CRIAR
SELECT 
    'ANTES: Dados do pedido 1419' as status,
    t_order.id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.store_id,
    t_order.colaboradora_id,
    (SELECT COUNT(*) FROM jsonb_array_elements(t_order.itens) AS item WHERE (item->>'quantidade') IS NOT NULL) as qtd_itens,
    (SELECT SUM((item->>'quantidade')::INTEGER) FROM jsonb_array_elements(t_order.itens) AS item WHERE (item->>'quantidade') IS NOT NULL) as qtd_pecas_calculada,
    CASE 
        WHEN EXISTS (SELECT 1 FROM sistemaretiradas.sales s WHERE s.tiny_order_id = t_order.id) THEN '✅ JÁ TEM VENDA'
        ELSE '❌ SEM VENDA'
    END as status_venda
FROM sistemaretiradas.tiny_orders t_order
WHERE t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb'
   OR t_order.numero_pedido = '1419';

-- 2. CRIAR VENDA MANUALMENTE (se não existir)
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
    ) as qtd_pecas,
    t_order.data_pedido,
    COALESCE(
        CASE 
            WHEN t_order.observacoes IS NOT NULL AND t_order.observacoes != '' 
            THEN t_order.observacoes || ' | Pedido Tiny: #' || t_order.numero_pedido
            ELSE 'Pedido Tiny: #' || t_order.numero_pedido
        END,
        'Pedido Tiny: #' || t_order.numero_pedido
    ) as observacoes,
    NULL
FROM sistemaretiradas.tiny_orders t_order
WHERE (t_order.id = '91f7122c-a11f-436b-8179-a95f80a8e2eb' OR t_order.numero_pedido = '1419')
  AND t_order.colaboradora_id IS NOT NULL
  AND t_order.store_id IS NOT NULL
  AND t_order.valor_total > 0
  AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.sales s 
      WHERE s.tiny_order_id = t_order.id
  )
ON CONFLICT (tiny_order_id) DO UPDATE SET
    colaboradora_id = EXCLUDED.colaboradora_id,
    store_id = EXCLUDED.store_id,
    valor = EXCLUDED.valor,
    qtd_pecas = EXCLUDED.qtd_pecas,
    data_venda = EXCLUDED.data_venda,
    observacoes = EXCLUDED.observacoes,
    updated_at = NOW()
RETURNING *;

-- 3. VERIFICAR RESULTADO APÓS CRIAR
SELECT 
    'DEPOIS: Venda criada' as status,
    s.id,
    s.data_venda,
    s.valor,
    s.qtd_pecas,
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
WHERE s.tiny_order_id = '91f7122c-a11f-436b-8179-a95f80a8e2eb'
   OR t_order.numero_pedido = '1419';

-- 4. EXECUTAR FUNÇÃO PARA CRIAR TODAS AS VENDAS PENDENTES
-- ⚠️ DESCOMENTE PARA EXECUTAR:
-- SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

