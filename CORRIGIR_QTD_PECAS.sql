-- ============================================================================
-- PROBLEMA: Pedidos com qtd_pecas = 0 ou NULL não criam vendas
-- SOLUÇÃO: Verificar e corrigir a quantidade de peças
-- ============================================================================

-- 1. Verificar o constraint atual
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.sales'::regclass
  AND conname = 'sales_qtd_pecas_check';

-- 2. Verificar qtd_pecas dos pedidos problemáticos
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  qtd_itens,
  itens_json,
  jsonb_array_length(itens_json::jsonb) as qtd_itens_json
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1429', '1432');

-- 3. Ver todos os pedidos com qtd_itens = 0 ou NULL
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  qtd_itens,
  itens_json IS NOT NULL as tem_itens_json,
  CASE 
    WHEN itens_json IS NOT NULL AND itens_json != '[]' 
    THEN jsonb_array_length(itens_json::jsonb) 
    ELSE 0 
  END as qtd_calculada
FROM sistemaretiradas.tiny_orders
WHERE (qtd_itens IS NULL OR qtd_itens = 0)
  AND valor_total > 0
ORDER BY data_pedido DESC
LIMIT 20;

-- 4. CORREÇÃO: Atualizar qtd_itens baseado no itens_json
UPDATE sistemaretiradas.tiny_orders
SET qtd_itens = CASE 
    WHEN itens_json IS NOT NULL AND itens_json != '[]' AND itens_json != 'null'
    THEN jsonb_array_length(itens_json::jsonb)
    ELSE 1  -- Default para 1 se não tiver itens_json
  END
WHERE (qtd_itens IS NULL OR qtd_itens = 0)
  AND valor_total > 0;

-- 5. Verificar se corrigiu
SELECT 
  numero_pedido,
  cliente_nome,
  qtd_itens,
  'CORRIGIDO' as status
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IN ('1426', '1429', '1432');

-- 6. REPROCESSAR as vendas
SELECT sistemaretiradas.criar_vendas_de_tiny_orders(
  NULL,
  (CURRENT_DATE - INTERVAL '7 days')::timestamptz
);

-- 7. Verificar se as vendas foram criadas
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
