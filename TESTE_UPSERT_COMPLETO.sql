-- ============================================================================
-- SCRIPT DE TESTE COMPLETO: Verificar Upsert e Constraint UNIQUE
-- ============================================================================
-- Execute este script para testar se o sistema está funcionando corretamente
-- ============================================================================

-- 1. VERIFICAR CONSTRAINT UNIQUE
SELECT 
  '=== 1. VERIFICAR CONSTRAINT UNIQUE ===' as teste;

SELECT 
  conname as constraint_name,
  contype as tipo,
  pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND conname = 'tiny_orders_numero_pedido_store_id_key';

-- 2. VERIFICAR SE HÁ DUPLICADOS (não deve haver)
SELECT 
  '=== 2. VERIFICAR DUPLICADOS ===' as teste;

SELECT 
  numero_pedido,
  store_id,
  COUNT(*) as quantidade
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IS NOT NULL
GROUP BY numero_pedido, store_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, numero_pedido
LIMIT 10;

-- 3. VERIFICAR SE HÁ numero_pedido NULL (não deve haver)
SELECT 
  '=== 3. VERIFICAR numero_pedido NULL ===' as teste;

SELECT 
  COUNT(*) as total_null,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sistemaretiradas.tiny_orders) as percentual
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IS NULL;

-- 4. VERIFICAR ÚLTIMOS 10 PEDIDOS SINCRONIZADOS
SELECT 
  '=== 4. ÚLTIMOS 10 PEDIDOS SINCRONIZADOS ===' as teste;

SELECT 
  id,
  numero_pedido,
  tiny_id,
  cliente_nome,
  valor_total,
  data_pedido,
  sync_at,
  store_id
FROM sistemaretiradas.tiny_orders
ORDER BY sync_at DESC NULLS LAST, data_pedido DESC NULLS LAST
LIMIT 10;

-- 5. VERIFICAR ESTATÍSTICAS DE SINCRONIZAÇÃO
SELECT 
  '=== 5. ESTATÍSTICAS DE SINCRONIZAÇÃO ===' as teste;

SELECT 
  COUNT(*) as total_pedidos,
  COUNT(DISTINCT numero_pedido) as pedidos_unicos,
  COUNT(DISTINCT store_id) as lojas,
  MIN(data_pedido) as pedido_mais_antigo,
  MAX(data_pedido) as pedido_mais_recente,
  MIN(sync_at) as primeira_sincronizacao,
  MAX(sync_at) as ultima_sincronizacao
FROM sistemaretiradas.tiny_orders;

-- 6. TESTE DE INSERÇÃO (simular upsert - não executar, apenas mostrar)
SELECT 
  '=== 6. TESTE DE UPSERT (EXEMPLO) ===' as teste;

-- Exemplo de como o código faz o upsert:
-- INSERT INTO sistemaretiradas.tiny_orders (numero_pedido, store_id, ...)
-- VALUES ('1414', 'store_id_here', ...)
-- ON CONFLICT (numero_pedido, store_id)
-- DO UPDATE SET ...;

-- 7. VERIFICAR SE O CONSTRAINT PERMITE UPSERT
SELECT 
  '=== 7. VERIFICAR SE CONSTRAINT PERMITE UPSERT ===' as teste;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_constraint 
      WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
        AND conname = 'tiny_orders_numero_pedido_store_id_key'
        AND contype = 'u'
    ) THEN '✅ CONSTRAINT UNIQUE EXISTE - UPSERT DEVE FUNCIONAR'
    ELSE '❌ CONSTRAINT UNIQUE NÃO EXISTE - UPSERT NÃO FUNCIONARÁ'
  END as status_upsert;

-- 8. VERIFICAR ESTRUTURA DA TABELA (colunas relevantes)
SELECT 
  '=== 8. ESTRUTURA DA TABELA (colunas relevantes) ===' as teste;

SELECT 
  column_name as coluna,
  data_type as tipo,
  is_nullable as permite_null,
  column_default as valor_padrao
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
  AND column_name IN ('id', 'numero_pedido', 'tiny_id', 'store_id', 'cliente_nome', 'valor_total', 'data_pedido', 'sync_at')
ORDER BY 
  CASE column_name
    WHEN 'id' THEN 1
    WHEN 'numero_pedido' THEN 2
    WHEN 'tiny_id' THEN 3
    WHEN 'store_id' THEN 4
    ELSE 5
  END;

-- 9. VERIFICAR ÍNDICES (para performance)
SELECT 
  '=== 9. ÍNDICES DA TABELA ===' as teste;

SELECT 
  indexname as indice,
  indexdef as definicao
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'tiny_orders'
ORDER BY indexname;

-- 10. TESTE DE VALIDAÇÃO FINAL
SELECT 
  '=== 10. VALIDAÇÃO FINAL ===' as teste;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
        AND conname = 'tiny_orders_numero_pedido_store_id_key'
    ) 
    AND NOT EXISTS (
      SELECT 1 FROM sistemaretiradas.tiny_orders 
      WHERE numero_pedido IS NULL
    )
    AND NOT EXISTS (
      SELECT numero_pedido, store_id 
      FROM sistemaretiradas.tiny_orders
      WHERE numero_pedido IS NOT NULL
      GROUP BY numero_pedido, store_id
      HAVING COUNT(*) > 1
    )
    THEN '✅ TUDO OK - Sistema pronto para upsert!'
    ELSE '❌ PROBLEMA DETECTADO - Verifique os testes acima'
  END as resultado_final;

-- ============================================================================
-- ✅ FIM DO TESTE
-- ============================================================================
-- Se todos os testes passarem, o sistema está pronto para funcionar!
-- ============================================================================

