-- ============================================================================
-- Script para Corrigir Índice Único em tiny_orders
-- ============================================================================
-- Este script garante que o índice único existe para permitir upsert correto
-- ============================================================================

-- 1. Remover índices antigos se existirem
DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_numero_store;
DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_tiny_id_store;

-- 2. Garantir que numero_pedido não seja NULL (atualizar registros antigos se necessário)
UPDATE sistemaretiradas.tiny_orders
SET numero_pedido = COALESCE(numero_pedido, tiny_id::text, 'SEM_NUMERO_' || id::text)
WHERE numero_pedido IS NULL;

-- 3. Adicionar constraint NOT NULL em numero_pedido (se não existir)
ALTER TABLE sistemaretiradas.tiny_orders 
  ALTER COLUMN numero_pedido SET NOT NULL;

-- 4. Criar constraint UNIQUE (não apenas índice) para ON CONFLICT funcionar
-- IMPORTANTE: Constraint UNIQUE é necessário para ON CONFLICT, não apenas índice
DO $$
BEGIN
  -- Remover constraint antigo se existir
  ALTER TABLE sistemaretiradas.tiny_orders 
    DROP CONSTRAINT IF EXISTS tiny_orders_numero_pedido_store_id_key;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Criar constraint UNIQUE
ALTER TABLE sistemaretiradas.tiny_orders 
  ADD CONSTRAINT tiny_orders_numero_pedido_store_id_key 
  UNIQUE (numero_pedido, store_id);

-- 5. Criar índice único em tiny_id + store_id para compatibilidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_tiny_orders_tiny_id_store 
ON sistemaretiradas.tiny_orders (tiny_id, store_id)
WHERE tiny_id IS NOT NULL;

-- 5. Verificar se os índices foram criados
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'tiny_orders'
  AND indexname LIKE 'idx_tiny_orders%'
ORDER BY indexname;

-- Comentários
COMMENT ON INDEX sistemaretiradas.idx_tiny_orders_numero_store IS 
'Índice único para upsert por numero_pedido + store_id. CRÍTICO para funcionamento do upsert.';

COMMENT ON INDEX sistemaretiradas.idx_tiny_orders_tiny_id_store IS 
'Índice único para compatibilidade com dados antigos (tiny_id + store_id).';

-- ============================================================================
-- ✅ PRONTO! Agora o upsert deve funcionar corretamente
-- ============================================================================

