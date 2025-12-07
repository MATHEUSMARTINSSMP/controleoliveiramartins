-- ============================================================================
-- CORREÇÃO DEFINITIVA: qtd_itens estava NULL porque o código não salvava
-- Este script corrige os pedidos existentes e reprocessa as vendas
-- ============================================================================

-- 1. Ver o problema: pedidos com qtd_itens = 0 ou NULL
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  qtd_itens,
  CASE 
    WHEN itens IS NOT NULL AND itens != '[]'::jsonb AND itens != 'null'
    THEN jsonb_array_length(itens)
    ELSE 0 
  END as qtd_itens_json,
  'PRECISA CORRIGIR' as status
FROM sistemaretiradas.tiny_orders
WHERE (qtd_itens IS NULL OR qtd_itens = 0)
  AND valor_total > 0
ORDER BY data_pedido DESC
LIMIT 30;

-- 2. CORREÇÃO: Calcular qtd_itens baseado no JSON de itens
-- Usa a soma das quantidades de cada item
UPDATE sistemaretiradas.tiny_orders
SET qtd_itens = (
  SELECT COALESCE(SUM((item->>'quantidade')::int), 1)
  FROM jsonb_array_elements(
    CASE 
      WHEN itens IS NOT NULL AND itens != '[]'::jsonb AND itens != 'null' AND jsonb_typeof(itens) = 'array'
      THEN itens
      ELSE '[]'::jsonb
    END
  ) AS item
)
WHERE (qtd_itens IS NULL OR qtd_itens = 0)
  AND valor_total > 0
  AND itens IS NOT NULL 
  AND itens != '[]'::jsonb 
  AND itens != 'null'
  AND jsonb_typeof(itens) = 'array'
  AND jsonb_array_length(itens) > 0;

-- 3. Para pedidos sem JSON de itens válido, definir qtd_itens = 1
UPDATE sistemaretiradas.tiny_orders
SET qtd_itens = 1
WHERE (qtd_itens IS NULL OR qtd_itens = 0)
  AND valor_total > 0;

-- 4. Verificar se corrigiu
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  qtd_itens,
  'CORRIGIDO' as status
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1429', '1432');

-- 5. REPROCESSAR as vendas
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,  -- Todas as lojas
  (CURRENT_DATE - INTERVAL '30 days')::timestamptz
);

-- 6. Verificar se as vendas foram criadas
SELECT 
  o.numero_pedido,
  o.cliente_nome,
  o.qtd_itens,
  s.id as sale_id,
  s.qtd_pecas,
  CASE WHEN s.id IS NULL THEN 'AINDA FALTA' ELSE 'CRIADA!' END as status
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = o.id
WHERE o.numero_pedido IN ('1426', '1429', '1432')
ORDER BY o.numero_pedido::int;

-- 7. Ver todas as vendas de hoje
SELECT 
  s.id,
  o.numero_pedido,
  o.cliente_nome,
  s.valor,
  s.qtd_pecas,
  s.data_venda,
  p.name as vendedora
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.tiny_orders o ON o.id = s.tiny_order_id
JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.data_venda >= CURRENT_DATE
ORDER BY s.data_venda DESC;
