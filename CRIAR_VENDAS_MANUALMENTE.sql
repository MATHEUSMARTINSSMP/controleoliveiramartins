-- ============================================================================
-- CRIAR VENDAS MANUALMENTE PARA OS 3 PEDIDOS PROBLEMÁTICOS
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. Verificar os dados dos pedidos
SELECT 
  id,
  numero_pedido,
  cliente_nome,
  cliente_id,
  valor_total,
  qtd_itens,
  store_id,
  colaboradora_id,
  data_pedido,
  status
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1429', '1432');

-- 2. Inserir as vendas diretamente (uma por uma para identificar erros)

-- Pedido 1426 - Cássia Favacho
INSERT INTO sistemaretiradas.sales (
  store_id,
  colaboradora_id,
  tiny_order_id,
  tiny_contact_id,
  valor_total,
  qtd_pecas,
  data_venda,
  created_at
)
SELECT 
  o.store_id,
  o.colaboradora_id,
  o.id as tiny_order_id,
  o.tiny_contact_id,
  o.valor_total,
  COALESCE(o.qtd_itens, 1) as qtd_pecas,
  COALESCE(o.data_pedido, o.created_at) as data_venda,
  NOW() as created_at
FROM sistemaretiradas.tiny_orders o
WHERE o.numero_pedido = '1426'
  AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.sales s WHERE s.tiny_order_id = o.id
  );

-- Pedido 1429 - Jesuiana Oliveira
INSERT INTO sistemaretiradas.sales (
  store_id,
  colaboradora_id,
  tiny_order_id,
  tiny_contact_id,
  valor_total,
  qtd_pecas,
  data_venda,
  created_at
)
SELECT 
  o.store_id,
  o.colaboradora_id,
  o.id as tiny_order_id,
  o.tiny_contact_id,
  o.valor_total,
  COALESCE(o.qtd_itens, 1) as qtd_pecas,
  COALESCE(o.data_pedido, o.created_at) as data_venda,
  NOW() as created_at
FROM sistemaretiradas.tiny_orders o
WHERE o.numero_pedido = '1429'
  AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.sales s WHERE s.tiny_order_id = o.id
  );

-- Pedido 1432 - Wendy Moura
INSERT INTO sistemaretiradas.sales (
  store_id,
  colaboradora_id,
  tiny_order_id,
  tiny_contact_id,
  valor_total,
  qtd_pecas,
  data_venda,
  created_at
)
SELECT 
  o.store_id,
  o.colaboradora_id,
  o.id as tiny_order_id,
  o.tiny_contact_id,
  o.valor_total,
  COALESCE(o.qtd_itens, 1) as qtd_pecas,
  COALESCE(o.data_pedido, o.created_at) as data_venda,
  NOW() as created_at
FROM sistemaretiradas.tiny_orders o
WHERE o.numero_pedido = '1432'
  AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.sales s WHERE s.tiny_order_id = o.id
  );

-- 3. Verificar se as vendas foram criadas
SELECT 
  o.numero_pedido,
  o.cliente_nome,
  o.qtd_itens,
  s.id as sale_id,
  s.qtd_pecas,
  s.valor_total,
  CASE WHEN s.id IS NULL THEN 'AINDA FALTA' ELSE 'CRIADA!' END as status
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE o.numero_pedido IN ('1426', '1429', '1432')
ORDER BY o.numero_pedido::int;
