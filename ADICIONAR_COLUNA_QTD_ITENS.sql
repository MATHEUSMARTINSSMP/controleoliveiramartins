-- ============================================================================
-- ADICIONAR COLUNA qtd_itens NA TABELA tiny_orders
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. Adicionar a coluna qtd_itens
ALTER TABLE sistemaretiradas.tiny_orders 
ADD COLUMN IF NOT EXISTS qtd_itens INTEGER DEFAULT 1;

-- 2. Atualizar qtd_itens para pedidos existentes baseado no JSON de itens
UPDATE sistemaretiradas.tiny_orders
SET qtd_itens = (
  SELECT COALESCE(SUM((item->>'quantidade')::int), 1)
  FROM jsonb_array_elements(
    CASE 
      WHEN itens IS NOT NULL AND itens != '[]'::jsonb AND itens != 'null' AND jsonb_typeof(itens) = 'array'
      THEN itens
      ELSE '[{"quantidade": 1}]'::jsonb
    END
  ) AS item
)
WHERE itens IS NOT NULL 
  AND itens != '[]'::jsonb 
  AND itens != 'null'
  AND jsonb_typeof(itens) = 'array'
  AND jsonb_array_length(itens) > 0;

-- 3. Garantir que todos os pedidos tenham pelo menos qtd_itens = 1
UPDATE sistemaretiradas.tiny_orders
SET qtd_itens = 1
WHERE qtd_itens IS NULL OR qtd_itens = 0;

-- 4. Verificar os pedidos problemáticos
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  qtd_itens,
  'CORRIGIDO' as status
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1429', '1432');

-- 5. Reprocessar as vendas
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,
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
