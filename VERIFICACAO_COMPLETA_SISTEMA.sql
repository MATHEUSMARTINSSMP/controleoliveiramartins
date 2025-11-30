-- ============================================================================
-- VERIFICAÇÃO COMPLETA DO SISTEMA
-- Data: 2025-01-31
-- Descrição: Script para verificar todos os componentes críticos do sistema
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR TRIGGERS
-- ============================================================================
SELECT 
    'TRIGGERS' as tipo,
    schemaname,
    tablename,
    triggername,
    tgtype::text as tipo_trigger,
    CASE 
        WHEN tgtype & 2 = 2 THEN 'BEFORE'
        WHEN tgtype & 64 = 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as timing,
    CASE 
        WHEN tgtype & 4 = 4 THEN 'INSERT'
        WHEN tgtype & 8 = 8 THEN 'DELETE'
        WHEN tgtype & 16 = 16 THEN 'UPDATE'
        ELSE 'UNKNOWN'
    END as evento
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND NOT t.tgisinternal
ORDER BY tablename, triggername;

-- ============================================================================
-- 2. VERIFICAR ÍNDICES
-- ============================================================================
SELECT 
    'INDICES' as tipo,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
ORDER BY tablename, indexname;

-- ============================================================================
-- 3. VERIFICAR CONSTRAINTS (UNIQUE, FOREIGN KEY, CHECK)
-- ============================================================================
SELECT 
    'CONSTRAINTS' as tipo,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'sistemaretiradas'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ============================================================================
-- 4. VERIFICAR FUNÇÕES (RPCs)
-- ============================================================================
SELECT 
    'FUNCOES' as tipo,
    n.nspname as schema,
    p.proname as nome_funcao,
    pg_get_function_result(p.oid) as tipo_retorno,
    pg_get_function_arguments(p.oid) as argumentos,
    CASE 
        WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
        WHEN p.provolatile = 's' THEN 'STABLE'
        WHEN p.provolatile = 'v' THEN 'VOLATILE'
    END as volatilidade,
    CASE 
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
ORDER BY p.proname;

-- ============================================================================
-- 5. VERIFICAR TABELAS PRINCIPAIS E SUAS ESTRUTURAS
-- ============================================================================
SELECT 
    'TABELAS' as tipo,
    table_schema,
    table_name,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_schema = t.table_schema 
       AND table_name = t.table_name) as num_colunas
FROM information_schema.tables t
WHERE table_schema = 'sistemaretiradas'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- 6. VERIFICAR JOBS DO PG_CRON
-- ============================================================================
SELECT 
    'CRON_JOBS' as tipo,
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job
ORDER BY jobid;

-- ============================================================================
-- 7. VERIFICAR RLS (Row Level Security) POLICIES
-- ============================================================================
SELECT 
    'RLS_POLICIES' as tipo,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
ORDER BY tablename, policyname;

-- ============================================================================
-- 8. VERIFICAR VIEWS
-- ============================================================================
SELECT 
    'VIEWS' as tipo,
    table_schema,
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'sistemaretiradas'
ORDER BY table_name;

-- ============================================================================
-- 9. VERIFICAR ÍNDICES CRÍTICOS PARA PERFORMANCE
-- ============================================================================
SELECT 
    'INDICES_CRITICOS' as tipo,
    schemaname,
    tablename,
    indexname,
    CASE 
        WHEN indexname LIKE '%unique%' OR indexname LIKE '%_key' THEN 'UNIQUE'
        WHEN indexname LIKE '%idx%' THEN 'INDEX'
        ELSE 'OTHER'
    END as tipo_indice
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND (
    indexname LIKE '%cashback%' OR
    indexname LIKE '%tiny_orders%' OR
    indexname LIKE '%sales%' OR
    indexname LIKE '%goals%' OR
    indexname LIKE '%stores%'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- 10. VERIFICAR FOREIGN KEYS (INTEGRIDADE REFERENCIAL)
-- ============================================================================
SELECT 
    'FOREIGN_KEYS' as tipo,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'sistemaretiradas'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 11. VERIFICAR TRIGGERS ESPECÍFICOS DO CASHBACK
-- ============================================================================
SELECT 
    'TRIGGERS_CASHBACK' as tipo,
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name,
    CASE 
        WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
        ELSE 'AFTER'
    END as timing,
    CASE 
        WHEN t.tgtype & 4 = 4 THEN 'INSERT'
        WHEN t.tgtype & 8 = 8 THEN 'DELETE'
        WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    END as evento
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND NOT t.tgisinternal
  AND (t.tgname LIKE '%cashback%' OR p.proname LIKE '%cashback%')
ORDER BY c.relname, t.tgname;

-- ============================================================================
-- 12. VERIFICAR COLUNA cashback_ativo NA TABELA stores
-- ============================================================================
SELECT 
    'COLUNA_CASHBACK_ATIVO' as tipo,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'stores'
  AND column_name = 'cashback_ativo';

-- ============================================================================
-- 13. VERIFICAR COLUNA tags NA TABELA tiny_contacts
-- ============================================================================
SELECT 
    'COLUNA_TAGS' as tipo,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_contacts'
  AND column_name = 'tags';

-- ============================================================================
-- 14. VERIFICAR CONSTRAINT ÚNICO EM tiny_orders
-- ============================================================================
SELECT 
    'CONSTRAINT_TINY_ORDERS' as tipo,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'sistemaretiradas'
  AND tc.table_name = 'tiny_orders'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- ============================================================================
-- 15. VERIFICAR ÚLTIMOS LOGS DE SINCRONIZAÇÃO
-- ============================================================================
SELECT 
    'SYNC_LOGS' as tipo,
    id,
    tipo_sync,
    status,
    registros_sincronizados,
    registros_atualizados,
    registros_com_erro,
    sync_at,
    error_message
FROM sistemaretiradas.erp_sync_logs
ORDER BY sync_at DESC
LIMIT 10;

-- ============================================================================
-- 16. VERIFICAR CONFIGURAÇÕES DO APP_CONFIG
-- ============================================================================
SELECT 
    'APP_CONFIG' as tipo,
    key,
    CASE 
        WHEN key LIKE '%key%' OR key LIKE '%token%' OR key LIKE '%secret%' THEN '***HIDDEN***'
        ELSE LEFT(value, 50)
    END as value_preview,
    description
FROM sistemaretiradas.app_config
ORDER BY key;

-- ============================================================================
-- 17. VERIFICAR ESTATÍSTICAS DE TABELAS PRINCIPAIS
-- ============================================================================
SELECT 
    'ESTATISTICAS' as tipo,
    schemaname,
    tablename,
    n_live_tup as registros_vivos,
    n_dead_tup as registros_mortos,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN (
    'tiny_orders',
    'cashback_transactions',
    'cashback_balance',
    'sales',
    'goals',
    'bonuses',
    'stores',
    'profiles'
  )
ORDER BY n_live_tup DESC;

-- ============================================================================
-- RESUMO FINAL
-- ============================================================================
SELECT 
    'RESUMO' as tipo,
    'Total de Triggers' as item,
    COUNT(*)::text as valor
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND NOT t.tgisinternal

UNION ALL

SELECT 
    'RESUMO' as tipo,
    'Total de Índices' as item,
    COUNT(*)::text as valor
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'

UNION ALL

SELECT 
    'RESUMO' as tipo,
    'Total de Tabelas' as item,
    COUNT(*)::text as valor
FROM information_schema.tables
WHERE table_schema = 'sistemaretiradas'
  AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
    'RESUMO' as tipo,
    'Total de Funções' as item,
    COUNT(*)::text as valor
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'

UNION ALL

SELECT 
    'RESUMO' as tipo,
    'Total de Jobs Cron' as item,
    COUNT(*)::text as valor
FROM cron.job

UNION ALL

SELECT 
    'RESUMO' as tipo,
    'Total de Foreign Keys' as item,
    COUNT(*)::text as valor
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'sistemaretiradas';

