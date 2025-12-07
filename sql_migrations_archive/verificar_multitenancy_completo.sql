-- ============================================================================
-- VERIFICAÇÃO COMPLETA DE MULTI-TENANCY
-- Execute este script no Supabase SQL Editor para verificar se está 100% pronto
-- ============================================================================

-- 1. VERIFICAR SE STORES TEM ADMIN_ID
SELECT 
    '1. VERIFICAR COLUNA admin_id EM stores' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'stores' 
            AND column_name = 'admin_id'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE - CRÍTICO!'
    END as status;

-- 2. VERIFICAR STORES SEM ADMIN_ID
SELECT 
    '2. STORES SEM ADMIN_ID' as verificacao,
    COUNT(*) as total_stores_sem_admin,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ TODAS AS LOJAS TÊM ADMIN'
        ELSE '❌ ' || COUNT(*) || ' LOJA(S) SEM ADMIN_ID'
    END as status
FROM sistemaretiradas.stores
WHERE active = true AND admin_id IS NULL;

-- 3. VERIFICAR ADMINS COM MÚLTIPLAS LOJAS
SELECT 
    '3. ADMINS COM MÚLTIPLAS LOJAS' as verificacao,
    p.id as admin_id,
    p.name as admin_name,
    COUNT(s.id) as total_lojas,
    CASE 
        WHEN COUNT(s.id) > 1 THEN '✅ MULTI-TENANCY FUNCIONANDO'
        WHEN COUNT(s.id) = 1 THEN '⚠️ APENAS 1 LOJA'
        ELSE '❌ SEM LOJAS'
    END as status
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON s.admin_id = p.id AND s.active = true
WHERE p.role = 'ADMIN' AND p.active = true
GROUP BY p.id, p.name
ORDER BY total_lojas DESC;

-- 4. VERIFICAR RLS NAS TABELAS PRINCIPAIS
SELECT 
    '4. RLS HABILITADO' as verificacao,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ HABILITADO'
        ELSE '❌ DESABILITADO'
    END as status_rls,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'sistemaretiradas' AND tablename = t.tablename) as num_politicas
FROM pg_tables t
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN (
    'stores', 'profiles', 'sales', 'goals', 
    'cashback_transactions', 'cashback_balance',
    'tiny_orders', 'tiny_contacts', 'adiantamentos', 'compras'
  )
ORDER BY tablename;

-- 5. VERIFICAR POLÍTICAS RLS QUE USAM ADMIN_ID
SELECT 
    '5. POLÍTICAS COM ADMIN_ID' as verificacao,
    tablename,
    policyname,
    CASE 
        WHEN qual::text LIKE '%admin_id%' OR with_check::text LIKE '%admin_id%' THEN '✅ USA ADMIN_ID'
        ELSE '❌ NÃO USA ADMIN_ID'
    END as status
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename IN ('stores', 'sales', 'goals', 'cashback_transactions', 'cashback_balance', 'tiny_orders')
  AND (
    qual::text LIKE '%admin_id%' 
    OR with_check::text LIKE '%admin_id%'
  )
ORDER BY tablename, policyname;

-- 6. VERIFICAR CAMPOS DE MULTI-TENANCY
SELECT 
    '6. CAMPOS MULTI-TENANCY' as verificacao,
    table_name,
    STRING_AGG(column_name, ', ' ORDER BY column_name) as campos_encontrados,
    CASE 
        WHEN table_name = 'stores' AND 'admin_id' = ANY(ARRAY_AGG(column_name)) THEN '✅ OK'
        WHEN table_name IN ('sales', 'goals', 'cashback_transactions', 'cashback_balance', 'tiny_orders') 
            AND 'store_id' = ANY(ARRAY_AGG(column_name)) THEN '✅ OK'
        ELSE '⚠️ VERIFICAR'
    END as status
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name IN ('stores', 'sales', 'goals', 'cashback_transactions', 'cashback_balance', 'tiny_orders')
  AND column_name IN ('admin_id', 'store_id', 'colaboradora_id')
GROUP BY table_name
ORDER BY table_name;

-- 7. VERIFICAR DADOS ÓRFÃOS (SEM VINCULAÇÃO)
SELECT 
    '7. DADOS ÓRFÃOS' as verificacao,
    'Stores sem admin_id' as tipo,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ NENHUM'
        ELSE '❌ ' || COUNT(*) || ' ENCONTRADO(S)'
    END as status
FROM sistemaretiradas.stores
WHERE active = true AND admin_id IS NULL

UNION ALL

SELECT 
    '7. DADOS ÓRFÃOS' as verificacao,
    'Sales sem store_id' as tipo,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ NENHUM'
        ELSE '❌ ' || COUNT(*) || ' ENCONTRADO(S)'
    END as status
FROM sistemaretiradas.sales
WHERE store_id IS NULL

UNION ALL

SELECT 
    '7. DADOS ÓRFÃOS' as verificacao,
    'Goals sem store_id' as tipo,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ NENHUM'
        ELSE '❌ ' || COUNT(*) || ' ENCONTRADO(S)'
    END as status
FROM sistemaretiradas.goals
WHERE store_id IS NULL;

-- 8. RESUMO FINAL
SELECT 
    '8. RESUMO FINAL' as verificacao,
    'Total Admins' as metrica,
    COUNT(*)::text as valor,
    '✅' as status
FROM sistemaretiradas.profiles
WHERE role = 'ADMIN' AND active = true

UNION ALL

SELECT 
    '8. RESUMO FINAL' as verificacao,
    'Total Lojas' as metrica,
    COUNT(*)::text as valor,
    '✅' as status
FROM sistemaretiradas.stores
WHERE active = true

UNION ALL

SELECT 
    '8. RESUMO FINAL' as verificacao,
    'Lojas com Admin' as metrica,
    COUNT(*)::text as valor,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(*) FROM sistemaretiradas.stores WHERE active = true) THEN '✅'
        ELSE '❌'
    END as status
FROM sistemaretiradas.stores
WHERE active = true AND admin_id IS NOT NULL

UNION ALL

SELECT 
    '8. RESUMO FINAL' as verificacao,
    'Total Colaboradoras' as metrica,
    COUNT(*)::text as valor,
    '✅' as status
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' AND active = true

UNION ALL

SELECT 
    '8. RESUMO FINAL' as verificacao,
    'Colaboradoras com Store' as metrica,
    COUNT(*)::text as valor,
    CASE 
        WHEN COUNT(*) = (SELECT COUNT(*) FROM sistemaretiradas.profiles WHERE role = 'COLABORADORA' AND active = true) THEN '✅'
        ELSE '❌'
    END as status
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' AND active = true AND store_id IS NOT NULL;

