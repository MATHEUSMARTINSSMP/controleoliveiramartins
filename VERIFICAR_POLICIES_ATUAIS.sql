-- ============================================================
-- QUERY PARA VER TODAS AS POLICIES ATUAIS DA TABELA PROFILES
-- ============================================================

-- Ver TODAS as policies da tabela profiles com detalhes completos
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

-- Verificar se há policies duplicadas
SELECT 
    policyname,
    cmd,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
GROUP BY policyname, cmd
HAVING COUNT(*) > 1
ORDER BY policyname;

-- Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles';

