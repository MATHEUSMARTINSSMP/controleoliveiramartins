-- ============================================================================
-- DIAGNÓSTICO: Pedidos 1426, 1429, 1432 que não aparecem no Dashboard
-- Execute cada bloco separadamente
-- ============================================================================

-- 1. Verificar se os pedidos existem em tiny_orders
SELECT 
  'tiny_orders' as tabela,
  numero_pedido,
  cliente_nome,
  valor_total,
  colaboradora_id,
  data_pedido,
  data_pedido::text as data_pedido_raw,
  (data_pedido AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date as dia_brt,
  vendedor_nome
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1427', '1428', '1429', '1430', '1431', '1432', '1433')
ORDER BY numero_pedido::int;

-- 2. Verificar se esses pedidos têm vendas correspondentes em sales
SELECT 
  o.numero_pedido,
  o.cliente_nome,
  o.valor_total,
  o.colaboradora_id as colab_tiny,
  s.id as sale_id,
  s.colaboradora_id as colab_sale,
  s.data_venda,
  s.data_venda::text as data_venda_raw,
  s.data_venda::date as dia_sale,
  CASE WHEN s.id IS NULL THEN 'FALTA VENDA' ELSE 'OK' END as status
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE o.numero_pedido IN ('1426', '1427', '1428', '1429', '1430', '1431', '1432', '1433')
ORDER BY o.numero_pedido::int;

-- 3. Verificar pedidos sem colaboradora_id
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  vendedor_nome,
  colaboradora_id,
  CASE WHEN colaboradora_id IS NULL THEN 'SEM COLABORADORA - NAO CRIA VENDA' ELSE 'OK' END as status
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1427', '1428', '1429', '1430', '1431', '1432', '1433')
ORDER BY numero_pedido::int;

-- 4. Se pedidos existem mas vendas não, verificar por que
-- Mostra detalhes dos pedidos que deveriam gerar vendas mas não geraram
SELECT 
  o.id,
  o.numero_pedido,
  o.cliente_nome,
  o.valor_total,
  o.colaboradora_id,
  o.store_id,
  o.data_pedido,
  CASE 
    WHEN o.colaboradora_id IS NULL THEN 'PROBLEMA: colaboradora_id NULL'
    WHEN o.store_id IS NULL THEN 'PROBLEMA: store_id NULL'
    WHEN o.valor_total <= 0 THEN 'PROBLEMA: valor_total <= 0'
    ELSE 'OK - DEVERIA CRIAR VENDA'
  END as diagnostico
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE o.numero_pedido IN ('1426', '1427', '1428', '1429', '1430', '1431', '1432', '1433')
  AND s.id IS NULL
ORDER BY o.numero_pedido::int;

-- 5. Listar todos os vendedores do Tiny e suas colaboradoras mapeadas
SELECT DISTINCT 
  o.vendedor_nome,
  o.colaboradora_id,
  p.name as colaboradora_nome,
  COUNT(*) as qtd_pedidos
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.profiles p ON p.id = o.colaboradora_id
WHERE o.data_pedido >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY o.vendedor_nome, o.colaboradora_id, p.name
ORDER BY o.vendedor_nome;

-- 6. FORÇAR criação das vendas faltantes
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,
  (CURRENT_DATE - INTERVAL '7 days')::timestamptz
);

-- 7. Verificar novamente após forçar
SELECT 
  o.numero_pedido,
  o.cliente_nome,
  s.id as sale_id,
  CASE WHEN s.id IS NULL THEN 'AINDA FALTA' ELSE 'CRIADA' END as status
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE o.numero_pedido IN ('1426', '1429', '1432')
ORDER BY o.numero_pedido::int;
