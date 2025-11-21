-- ============================================================
-- VERIFICAR POLICIES RLS DA TABELA SALES
-- ============================================================

-- 1. Ver TODAS as policies da tabela sales
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as full_qual_condition,
    with_check as full_with_check_condition
FROM pg_policies
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'sales'
ORDER BY policyname;

-- 2. Verificar se RLS está habilitado na tabela sales
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'sales';

-- 3. Verificar grants na tabela sales
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'sales'
ORDER BY grantee, privilege_type;

