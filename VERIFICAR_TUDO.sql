-- Script para verificar se tudo está funcionando corretamente
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR TODAS AS POLÍTICAS DA TABELA profiles
-- ============================================

SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%profiles%' THEN '✅ Direto (sem recursão)'
    WHEN qual LIKE '%role%' AND qual NOT LIKE '%profiles%' THEN '✅ Verifica role diretamente (sem recursão)'
    WHEN qual LIKE '%check_is_admin%' THEN '✅ Usa função SECURITY DEFINER (sem recursão)'
    ELSE '⚠️ Verificar'
  END as recursion_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- 2. VERIFICAR FUNÇÕES
-- ============================================

-- Verificar check_is_admin
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER (Bypassa RLS)'
    ELSE '❌ SECURITY INVOKER (NÃO bypassa RLS)'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND (p.proname = 'check_is_admin' OR p.proname = 'is_user_admin')
ORDER BY p.proname;

-- ============================================
-- 3. VERIFICAR RLS ESTÁ HABILITADO
-- ============================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles';

-- ============================================
-- 4. CONTAR POLÍTICAS ESPERADAS
-- ============================================

-- Devemos ter 7 políticas:
-- 1. profiles_own_access
-- 2. profiles_select_colaboradoras
-- 3. profiles_select_loja
-- 4. profiles_admin_select_all
-- 5. profiles_admin_insert
-- 6. profiles_admin_update
-- 7. profiles_admin_delete

SELECT 
  COUNT(*) as total_policies,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ Todas as políticas foram criadas'
    WHEN COUNT(*) > 7 THEN '⚠️ Mais políticas do que esperado'
    WHEN COUNT(*) < 7 THEN '❌ Faltam políticas'
  END as status
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles';

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- ✅ 7 políticas criadas
-- ✅ Função check_is_admin criada como SECURITY DEFINER
-- ✅ RLS habilitado na tabela profiles
-- ✅ Todas as políticas sem recursão

