-- ============================================================================
-- Migration: Corrigir Constraint Único em tiny_orders
-- Data: 2025-01-30
-- Descrição: Garantir que numero_pedido + store_id seja único para upsert correto
-- ============================================================================

-- 1. Remover constraint antigo se existir (pode estar em tiny_id)
DO $$
BEGIN
  -- Tentar remover constraint antigo em tiny_id,store_id se existir
  ALTER TABLE sistemaretiradas.tiny_orders 
    DROP CONSTRAINT IF EXISTS tiny_orders_tiny_id_store_id_key;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignorar se não existir
END $$;

-- 2. Remover índices únicos antigos se existirem
DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_numero_store;
DROP INDEX IF EXISTS sistemaretiradas.idx_tiny_orders_tiny_id_store;

-- 3. ✅ LIMPAR DUPLICADOS: Remover registros duplicados mantendo o mais recente
-- Identifica duplicados por numero_pedido + store_id e mantém apenas o mais recente (sync_at mais recente)
DO $$
DECLARE
  duplicados_count INTEGER;
BEGIN
  -- Contar duplicados
  SELECT COUNT(*) INTO duplicados_count
  FROM (
    SELECT numero_pedido, store_id, COUNT(*) as cnt
    FROM sistemaretiradas.tiny_orders
    WHERE numero_pedido IS NOT NULL
    GROUP BY numero_pedido, store_id
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'Encontrados % grupos de duplicados por numero_pedido + store_id', duplicados_count;
  
  -- Remover duplicados mantendo apenas o mais recente (sync_at mais recente)
  -- Se sync_at for NULL, manter o com ID maior (mais recente)
  DELETE FROM sistemaretiradas.tiny_orders
  WHERE id IN (
    SELECT id
    FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY numero_pedido, store_id 
          ORDER BY 
            COALESCE(sync_at, '1970-01-01'::timestamp) DESC,
            id DESC
        ) as rn
      FROM sistemaretiradas.tiny_orders
      WHERE numero_pedido IS NOT NULL
    ) ranked
    WHERE rn > 1
  );
  
  GET DIAGNOSTICS duplicados_count = ROW_COUNT;
  RAISE NOTICE 'Removidos % registros duplicados', duplicados_count;
END $$;

-- 4. Criar índice único em numero_pedido + store_id (mais confiável)
-- Isso permite upsert correto usando numero_pedido como identificador principal
CREATE UNIQUE INDEX idx_tiny_orders_numero_store 
ON sistemaretiradas.tiny_orders (numero_pedido, store_id) 
WHERE numero_pedido IS NOT NULL;

-- 5. Manter índice único em tiny_id + store_id para compatibilidade (dados antigos)
-- Primeiro limpar duplicados em tiny_id também
DO $$
DECLARE
  duplicados_tiny_id_count INTEGER;
BEGIN
  -- Remover duplicados por tiny_id + store_id mantendo o mais recente
  DELETE FROM sistemaretiradas.tiny_orders
  WHERE id IN (
    SELECT id
    FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY tiny_id, store_id 
          ORDER BY 
            COALESCE(sync_at, '1970-01-01'::timestamp) DESC,
            id DESC
        ) as rn
      FROM sistemaretiradas.tiny_orders
      WHERE tiny_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  );
  
  GET DIAGNOSTICS duplicados_tiny_id_count = ROW_COUNT;
  IF duplicados_tiny_id_count > 0 THEN
    RAISE NOTICE 'Removidos % registros duplicados por tiny_id + store_id', duplicados_tiny_id_count;
  END IF;
END $$;

CREATE UNIQUE INDEX idx_tiny_orders_tiny_id_store 
ON sistemaretiradas.tiny_orders (tiny_id, store_id) 
WHERE tiny_id IS NOT NULL;

-- Comentários
COMMENT ON INDEX sistemaretiradas.idx_tiny_orders_numero_store IS 
'Índice único para upsert por numero_pedido + store_id (identificador principal). Duplicados foram removidos mantendo o registro mais recente.';

COMMENT ON INDEX sistemaretiradas.idx_tiny_orders_tiny_id_store IS 
'Índice único para compatibilidade com dados antigos (tiny_id + store_id). Duplicados foram removidos mantendo o registro mais recente.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================
-- Esta migration:
-- 1. Remove duplicados por numero_pedido + store_id (mantém o mais recente)
-- 2. Remove duplicados por tiny_id + store_id (mantém o mais recente)
-- 3. Cria índices únicos em ambos os campos
-- 
-- Agora o sistema pode fazer upsert usando:
-- 1. numero_pedido + store_id (preferencial)
-- 2. tiny_id + store_id (fallback/compatibilidade)
-- ============================================================================

