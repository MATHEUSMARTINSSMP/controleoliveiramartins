-- Verificar políticas de UPDATE na tabela profiles
-- Execute este SQL no Supabase para ver todas as políticas de UPDATE

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    CASE 
        WHEN qual IS NULL THEN 'Sem condição USING'
        ELSE 'Tem condição USING'
    END as has_using,
    CASE 
        WHEN with_check IS NULL THEN 'Sem condição WITH CHECK'
        ELSE 'Tem condição WITH CHECK'
    END as has_with_check
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles';

-- Verificar todas as políticas (SELECT, INSERT, UPDATE, DELETE) na tabela profiles
SELECT 
    cmd,
    policyname,
    permissive,
    roles,
    CASE 
        WHEN qual IS NULL THEN 'N/A'
        ELSE substring(qual, 1, 100) || '...'
    END as using_condition,
    CASE 
        WHEN with_check IS NULL THEN 'N/A'
        ELSE substring(with_check, 1, 100) || '...'
    END as with_check_condition
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

