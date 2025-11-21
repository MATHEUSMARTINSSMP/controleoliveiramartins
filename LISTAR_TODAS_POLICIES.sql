-- ============================================================
-- QUERIES PARA LISTAR TODAS AS POLICIES RLS DO SUPABASE
-- ============================================================

-- 1. Listar TODAS as policies do schema sistemaretiradas
SELECT 
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

-- 2. Listar todas as policies da tabela profiles especificamente
SELECT 
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
  AND tablename = 'profiles'
ORDER BY policyname;

-- 3. Verificar se RLS está habilitado em todas as tabelas do schema
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
ORDER BY tablename;

-- 4. Listar TODAS as policies de TODAS as tabelas (incluindo public schema)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual, 1, 200)
        ELSE NULL
    END as qual_preview,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check, 1, 200)
        ELSE NULL
    END as with_check_preview
FROM pg_policies
ORDER BY schemaname, tablename, policyname;

-- 5. Ver detalhes completos das policies da tabela profiles (com definição completa)
SELECT 
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd,
    p.qual as full_qual_condition,
    p.with_check as full_with_check_condition,
    CASE 
        WHEN p.qual IS NOT NULL THEN length(p.qual)
        ELSE 0
    END as qual_length,
    CASE 
        WHEN p.with_check IS NOT NULL THEN length(p.with_check)
        ELSE 0
    END as with_check_length
FROM pg_policies p
WHERE p.schemaname = 'sistemaretiradas' 
  AND p.tablename = 'profiles'
ORDER BY p.policyname;

-- 6. Contar policies por tabela
SELECT 
    schemaname,
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 7. Verificar grants na tabela profiles
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- 8. Verificar se há policies conflitantes ou duplicadas na tabela profiles
SELECT 
    policyname,
    cmd,
    COUNT(*) as occurrence_count
FROM pg_policies
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
GROUP BY policyname, cmd
HAVING COUNT(*) > 1
ORDER BY policyname;

