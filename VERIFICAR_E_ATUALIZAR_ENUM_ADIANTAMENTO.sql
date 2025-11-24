-- =============================================================================
-- VERIFICAR E ATUALIZAR ENUM status_adiantamento
-- =============================================================================
-- Este script verifica os valores atuais do enum e adiciona CANCELADO se necessário
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. VERIFICAR VALORES ATUAIS DO ENUM
-- =============================================================================
SELECT 
  'Valores atuais do enum status_adiantamento:' as info,
  unnest(enum_range(NULL::status_adiantamento)) as valores;

-- =============================================================================
-- 2. VERIFICAR SE CANCELADO JÁ EXISTE
-- =============================================================================
DO $$
DECLARE
  enum_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'CANCELADO' 
      AND enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'status_adiantamento'
          AND typnamespace = (
            SELECT oid 
            FROM pg_namespace 
            WHERE nspname = 'sistemaretiradas'
          )
      )
  ) INTO enum_exists;
  
  IF NOT enum_exists THEN
    RAISE NOTICE 'CANCELADO não existe no enum. Adicionando...';
    ALTER TYPE status_adiantamento ADD VALUE 'CANCELADO';
    RAISE NOTICE 'CANCELADO adicionado com sucesso!';
  ELSE
    RAISE NOTICE 'CANCELADO já existe no enum.';
  END IF;
END $$;

-- =============================================================================
-- 3. VERIFICAR VALORES FINAIS DO ENUM
-- =============================================================================
SELECT 
  'Valores finais do enum status_adiantamento:' as info,
  unnest(enum_range(NULL::status_adiantamento)) as valores;

-- =============================================================================
-- 4. VERIFICAR ESTRUTURA DA TABELA adiantamentos
-- =============================================================================
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'adiantamentos'
  AND column_name = 'status';

