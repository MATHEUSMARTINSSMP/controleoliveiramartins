-- ============================================================================
-- Script para Listar TODAS as Tabelas e Colunas do Schema sistemaretiradas
-- ============================================================================

-- 1. LISTAR TODAS AS TABELAS DO SCHEMA
SELECT 
  schemaname as schema,
  tablename as tabela,
  tableowner as proprietario
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
ORDER BY tablename;

-- 2. LISTAR TODAS AS COLUNAS DE TODAS AS TABELAS
SELECT 
  t.table_schema as schema,
  t.table_name as tabela,
  c.column_name as coluna,
  c.data_type as tipo_dado,
  c.character_maximum_length as tamanho_max,
  c.is_nullable as permite_null,
  c.column_default as valor_padrao,
  CASE 
    WHEN pk.column_name IS NOT NULL THEN 'SIM'
    ELSE 'NÃO'
  END as eh_chave_primaria
FROM information_schema.tables t
INNER JOIN information_schema.columns c 
  ON t.table_schema = c.table_schema 
  AND t.table_name = c.table_name
LEFT JOIN (
  SELECT ku.table_schema, ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  INNER JOIN information_schema.key_column_usage ku
    ON tc.constraint_type = 'PRIMARY KEY'
    AND tc.constraint_name = ku.constraint_name
) pk 
  ON c.table_schema = pk.table_schema
  AND c.table_name = pk.table_name
  AND c.column_name = pk.column_name
WHERE t.table_schema = 'sistemaretiradas'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 3. LISTAR TODOS OS ÍNDICES DO SCHEMA
SELECT 
  schemaname as schema,
  tablename as tabela,
  indexname as indice,
  indexdef as definicao
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
ORDER BY tablename, indexname;

-- 4. LISTAR TODOS OS CONSTRAINTS (UNIQUE, FOREIGN KEY, CHECK, etc)
SELECT 
  tc.table_schema as schema,
  tc.table_name as tabela,
  tc.constraint_name as constraint,
  tc.constraint_type as tipo,
  kcu.column_name as coluna,
  tc.is_deferrable as pode_adiar,
  tc.initially_deferred as adiado_inicialmente
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'sistemaretiradas'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5. LISTAR ESPECIFICAMENTE CONSTRAINTS UNIQUE (para verificar upsert)
SELECT 
  tc.table_schema as schema,
  tc.table_name as tabela,
  tc.constraint_name as constraint_unique,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as colunas
FROM information_schema.table_constraints tc
INNER JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'sistemaretiradas'
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 6. VERIFICAR ESPECIFICAMENTE A TABELA tiny_orders
SELECT 
  '=== TABELA: tiny_orders ===' as info;

SELECT 
  column_name as coluna,
  data_type as tipo,
  is_nullable as permite_null,
  column_default as valor_padrao
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
ORDER BY ordinal_position;

SELECT 
  '=== ÍNDICES em tiny_orders ===' as info;

SELECT 
  indexname as indice,
  indexdef as definicao
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'tiny_orders'
ORDER BY indexname;

SELECT 
  '=== CONSTRAINTS em tiny_orders ===' as info;

SELECT 
  tc.constraint_name as constraint,
  tc.constraint_type as tipo,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as colunas
FROM information_schema.table_constraints tc
INNER JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'sistemaretiradas'
  AND tc.table_name = 'tiny_orders'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- ============================================================================
-- ✅ Execute este script para ver TODA a estrutura do banco
-- ============================================================================

