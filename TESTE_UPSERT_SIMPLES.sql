-- ============================================================================
-- TESTE RÁPIDO: Verificar se Upsert Funciona
-- ============================================================================
-- Execute este script para verificar rapidamente se está tudo OK
-- ============================================================================

-- 1. Constraint existe?
SELECT 
  'Constraint UNIQUE existe?' as pergunta,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
        AND conname = 'tiny_orders_numero_pedido_store_id_key'
    ) THEN '✅ SIM'
    ELSE '❌ NÃO'
  END as resposta;

-- 2. Há duplicados?
SELECT 
  'Há duplicados em (numero_pedido, store_id)?' as pergunta,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM sistemaretiradas.tiny_orders
      WHERE numero_pedido IS NOT NULL
      GROUP BY numero_pedido, store_id
      HAVING COUNT(*) > 1
    ) THEN '❌ SIM - CORRIGIR!'
    ELSE '✅ NÃO'
  END as resposta;

-- 3. Há numero_pedido NULL?
SELECT 
  'Há numero_pedido NULL?' as pergunta,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM sistemaretiradas.tiny_orders
      WHERE numero_pedido IS NULL
    ) THEN '❌ SIM - CORRIGIR!'
    ELSE '✅ NÃO'
  END as resposta;

-- 4. Últimos 5 pedidos
SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  sync_at
FROM sistemaretiradas.tiny_orders
ORDER BY sync_at DESC NULLS LAST
LIMIT 5;

-- 5. Status final
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
        AND conname = 'tiny_orders_numero_pedido_store_id_key'
    )
    AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.tiny_orders WHERE numero_pedido IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.tiny_orders
      WHERE numero_pedido IS NOT NULL
      GROUP BY numero_pedido, store_id
      HAVING COUNT(*) > 1
    )
    THEN '✅ SISTEMA PRONTO PARA UPSERT!'
    ELSE '❌ CORRIGIR PROBLEMAS ACIMA'
  END as status_final;

