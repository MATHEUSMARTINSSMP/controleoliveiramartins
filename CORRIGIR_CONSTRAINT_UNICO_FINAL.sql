-- ============================================================================
-- Script FINAL para Corrigir Constraint UNIQUE em tiny_orders
-- ============================================================================
-- PROBLEMA: O código usa onConflict: 'numero_pedido,store_id' mas o constraint
-- existente é 'store_id,tiny_id'. Precisamos criar o constraint correto.
-- ============================================================================

-- 1. Verificar constraints existentes
SELECT 
  '=== CONSTRAINTS EXISTENTES ===' as info;

SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
ORDER BY contype, conname;

-- 2. Garantir que numero_pedido não seja NULL (atualizar registros antigos se necessário)
UPDATE sistemaretiradas.tiny_orders
SET numero_pedido = COALESCE(numero_pedido, tiny_id::text, 'SEM_NUMERO_' || id::text)
WHERE numero_pedido IS NULL;

-- 3. Adicionar constraint NOT NULL em numero_pedido (se não existir)
DO $$
BEGIN
  -- Verificar se já é NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'sistemaretiradas'
      AND table_name = 'tiny_orders'
      AND column_name = 'numero_pedido'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE sistemaretiradas.tiny_orders 
      ALTER COLUMN numero_pedido SET NOT NULL;
    RAISE NOTICE 'Constraint NOT NULL adicionado em numero_pedido';
  ELSE
    RAISE NOTICE 'numero_pedido já é NOT NULL';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao adicionar NOT NULL: %', SQLERRM;
END $$;

-- 4. Remover constraint UNIQUE antigo se existir (store_id, tiny_id)
-- Mas manter se não tivermos o novo ainda
DO $$
BEGIN
  -- Só remover se o novo constraint já existir
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'tiny_orders_numero_pedido_store_id_key'
      AND conrelid = 'sistemaretiradas.tiny_orders'::regclass
  ) THEN
    -- Novo constraint existe, podemos remover o antigo se quiser
    -- Mas vamos manter ambos por compatibilidade
    RAISE NOTICE 'Constraint novo já existe, mantendo ambos';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 5. Criar constraint UNIQUE em numero_pedido + store_id (CRÍTICO para upsert)
DO $$
BEGIN
  -- Verificar se já existe
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'tiny_orders_numero_pedido_store_id_key'
      AND conrelid = 'sistemaretiradas.tiny_orders'::regclass
  ) THEN
    -- Criar constraint UNIQUE
    ALTER TABLE sistemaretiradas.tiny_orders 
      ADD CONSTRAINT tiny_orders_numero_pedido_store_id_key 
      UNIQUE (numero_pedido, store_id);
    
    RAISE NOTICE '✅ Constraint UNIQUE criado: tiny_orders_numero_pedido_store_id_key';
  ELSE
    RAISE NOTICE 'Constraint UNIQUE já existe: tiny_orders_numero_pedido_store_id_key';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Erro ao criar constraint: %', SQLERRM;
  RAISE;
END $$;

-- 6. Verificar se o constraint foi criado corretamente
SELECT 
  '=== VERIFICAÇÃO FINAL ===' as info;

SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.tiny_orders'::regclass
  AND contype = 'u'  -- 'u' = UNIQUE
ORDER BY conname;

-- 7. Verificar se há duplicados que impedem a criação do constraint
SELECT 
  '=== VERIFICAR DUPLICADOS ===' as info;

SELECT 
  numero_pedido,
  store_id,
  COUNT(*) as quantidade
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido IS NOT NULL
GROUP BY numero_pedido, store_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, numero_pedido;

-- ============================================================================
-- ✅ PRONTO! Agora o upsert deve funcionar corretamente
-- ============================================================================
-- O constraint UNIQUE em (numero_pedido, store_id) permite que o código
-- use onConflict: 'numero_pedido,store_id' corretamente.
-- ============================================================================

