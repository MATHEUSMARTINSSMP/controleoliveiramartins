-- =============================================================================
-- VERIFICAR ENUM CORRETO PARA status_adiantamento
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- 1. Verificar estrutura da coluna status na tabela adiantamentos
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name,
  udt_schema
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'adiantamentos'
  AND column_name = 'status';

-- 2. Verificar todos os tipos enum no schema sistemaretiradas
SELECT 
  n.nspname as schema_name,
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND t.typtype = 'e'
ORDER BY t.typname, e.enumsortorder;

-- 3. Verificar se existe enum com "adiantamento" no nome
SELECT 
  n.nspname as schema_name,
  t.typname as enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as valores
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND t.typtype = 'e'
  AND (t.typname ILIKE '%adiantamento%' OR t.typname ILIKE '%status%')
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- 4. Verificar valores únicos de status na tabela adiantamentos (para referência)
SELECT DISTINCT status
FROM sistemaretiradas.adiantamentos
ORDER BY status;

