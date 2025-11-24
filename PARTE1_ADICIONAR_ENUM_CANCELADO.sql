-- =============================================================================
-- PARTE 1: ADICIONAR CANCELADO AO ENUM status_adiantamento
-- =============================================================================
-- Execute este script PRIMEIRO
-- Após executar, faça COMMIT (ou aguarde o commit automático do Supabase)
-- Depois execute PARTE2_CRIAR_POLITICA_RLS.sql
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Descobrir e adicionar CANCELADO ao enum
DO $$
DECLARE
  v_enum_schema TEXT;
  v_enum_name TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Buscar o tipo da coluna status
  SELECT 
    udt_schema,
    udt_name
  INTO 
    v_enum_schema,
    v_enum_name
  FROM information_schema.columns
  WHERE table_schema = 'sistemaretiradas'
    AND table_name = 'adiantamentos'
    AND column_name = 'status';
  
  IF v_enum_schema IS NULL OR v_enum_name IS NULL THEN
    RAISE EXCEPTION 'Não foi possível encontrar o tipo da coluna status na tabela adiantamentos';
  END IF;
  
  RAISE NOTICE 'Enum encontrado: %.%', v_enum_schema, v_enum_name;
  
  -- Verificar se CANCELADO já existe
  SELECT EXISTS (
    SELECT 1 
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = v_enum_schema
      AND t.typname = v_enum_name
      AND e.enumlabel = 'CANCELADO'
  ) INTO v_exists;
  
  -- Se não existir, adicionar
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', v_enum_schema, v_enum_name, 'CANCELADO');
    RAISE NOTICE '✅ CANCELADO adicionado ao enum %.%', v_enum_schema, v_enum_name;
  ELSE
    RAISE NOTICE 'ℹ️ CANCELADO já existe no enum %.%', v_enum_schema, v_enum_name;
  END IF;
END $$;

-- Verificar valores do enum após adição
SELECT 
  e.enumlabel as valor_enum,
  e.enumsortorder as ordem
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
JOIN information_schema.columns c ON c.udt_schema = n.nspname AND c.udt_name = t.typname
WHERE c.table_schema = 'sistemaretiradas'
  AND c.table_name = 'adiantamentos'
  AND c.column_name = 'status'
ORDER BY e.enumsortorder;

