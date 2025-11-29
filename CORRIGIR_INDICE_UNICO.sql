-- ============================================================================
-- Script para Corrigir Índice Único em tiny_orders
-- ============================================================================
-- Este script garante que o índice único existe para permitir upsert correto
-- ============================================================================

-- 1. Remover índices antigos se existirem (usar IF EXISTS para evitar erros)
DO $$
BEGIN
  DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_numero_store;
  DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_tiny_id_store;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorar erros se não existir
END $$;

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
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'tiny_orders_numero_pedido_store_id_key'
      AND conrelid = 'sistemaretiradas.tiny_orders'::regclass
  ) THEN
    ALTER TABLE sistemaretiradas.tiny_orders 
      DROP CONSTRAINT tiny_orders_numero_pedido_store_id_key;
  END IF;
  
  -- Criar constraint UNIQUE se não existir
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'tiny_orders_numero_pedido_store_id_key'
      AND conrelid = 'sistemaretiradas.tiny_orders'::regclass
  ) THEN
    ALTER TABLE sistemaretiradas.tiny_orders 
      ADD CONSTRAINT tiny_orders_numero_pedido_store_id_key 
      UNIQUE (numero_pedido, store_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao criar constraint: %', SQLERRM;
END $$;

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

-- 6. Verificar se o constraint foi criado
SELECT 
  '=== CONSTRAINT UNIQUE ===' as info;

SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND conname = 'tiny_orders_numero_pedido_store_id_key';

-- Comentários (apenas se o índice existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'sistemaretiradas' 
      AND tablename = 'tiny_orders' 
      AND indexname = 'idx_tiny_orders_tiny_id_store'
  ) THEN
    COMMENT ON INDEX sistemaretiradas.idx_tiny_orders_tiny_id_store IS 
    'Índice único para compatibilidade com dados antigos (tiny_id + store_id).';
  END IF;
END $$;

-- ============================================================================
-- ✅ PRONTO! Agora o upsert deve funcionar corretamente
-- ============================================================================

