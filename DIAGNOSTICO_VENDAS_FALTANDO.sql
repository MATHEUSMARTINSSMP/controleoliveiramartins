-- ============================================================================
-- DIAGNÓSTICO: Por que vendas não aparecem?
-- Execute cada bloco separadamente para ver os resultados
-- ============================================================================

-- 1. PEDIDOS TINY SEM VENDA CORRESPONDENTE (colaboradora OK)
-- Se aparecer registros aqui, são vendas que DEVERIAM existir mas não existem
SELECT 
  o.numero_pedido,
  o.data_pedido,
  o.data_pedido AT TIME ZONE 'America/Sao_Paulo' as data_pedido_brt,
  o.valor_total,
  o.cliente_nome,
  o.colaboradora_id,
  p.name as colaboradora_nome,
  'FALTA CRIAR VENDA' as status
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
LEFT JOIN sistemaretiradas.profiles p ON p.id = o.colaboradora_id
WHERE s.id IS NULL
  AND o.colaboradora_id IS NOT NULL
  AND o.valor_total > 0
ORDER BY o.data_pedido DESC
LIMIT 20;

-- 2. PEDIDOS TINY SEM COLABORADORA MAPEADA
-- Se aparecer registros aqui, são vendas que NÃO PODEM ser criadas (falta vendedora)
SELECT 
  o.numero_pedido,
  o.data_pedido,
  o.valor_total,
  o.cliente_nome,
  o.vendedor_nome,
  'SEM COLABORADORA MAPEADA' as status
FROM sistemaretiradas.tiny_orders o
WHERE o.colaboradora_id IS NULL
  AND o.valor_total > 0
ORDER BY o.data_pedido DESC
LIMIT 20;

-- 3. COMPARAR VENDAS: tiny_orders vs sales
-- Mostra se há diferença entre quantidades
SELECT 
  'Pedidos Tiny com colaboradora' as categoria,
  COUNT(*) as total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NOT NULL AND valor_total > 0

UNION ALL

SELECT 
  'Vendas criadas do Tiny' as categoria,
  COUNT(*) as total
FROM sistemaretiradas.sales
WHERE tiny_order_id IS NOT NULL

UNION ALL

SELECT 
  'Vendas manuais (sem Tiny)' as categoria,
  COUNT(*) as total
FROM sistemaretiradas.sales
WHERE tiny_order_id IS NULL;

-- 4. VENDAS DOS ÚLTIMOS 3 DIAS - Ver como estão as datas
SELECT 
  s.id,
  o.numero_pedido,
  o.data_pedido as data_tiny,
  s.data_venda as data_sale,
  s.data_venda::date as dia_sale,
  (s.data_venda AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date as dia_brt,
  s.valor,
  p.name as vendedora
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.tiny_orders o ON o.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.data_venda >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY s.data_venda DESC
LIMIT 30;

-- 5. FORÇAR REPROCESSAMENTO DE TODAS AS VENDAS
-- Isso vai criar vendas que estão faltando
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,  -- Todas as lojas
  (CURRENT_DATE - INTERVAL '30 days')::timestamptz  -- Últimos 30 dias
);
