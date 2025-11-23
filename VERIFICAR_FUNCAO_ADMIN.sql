-- Script para verificar se a função check_is_admin foi criada corretamente
-- Execute no Supabase SQL Editor para verificar

-- ============================================
-- 1. VERIFICAR SE A FUNÇÃO EXISTE
-- ============================================

SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'check_is_admin';

-- ============================================
-- 2. VERIFICAR PROPRIEDADES DA FUNÇÃO
-- ============================================

SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER (✅ Bypassa RLS)'
    ELSE 'SECURITY INVOKER (❌ NÃO bypassa RLS)'
  END as security_type,
  pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'check_is_admin';

-- ============================================
-- 3. VERIFICAR POLÍTICAS DA TABELA profiles
-- ============================================

SELECT 
  policyname,
  cmd,
  qual,
  with_check,
  CASE 
    WHEN qual LIKE '%check_is_admin%' THEN '✅ Usa função SECURITY DEFINER'
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%profiles%' THEN '✅ Direto (sem recursão)'
    ELSE '⚠️ Verificar se causa recursão'
  END as recursion_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- 4. TESTE: VERIFICAR SE CONSEGUE VER O PRÓPRIO PERFIL
-- ============================================

-- Execute esta query logado para testar:
-- SELECT id, name, email, role FROM sistemaretiradas.profiles WHERE id = auth.uid();

-- ============================================
-- 5. SE A FUNÇÃO NÃO EXISTIR OU NÃO FOR SECURITY DEFINER, RECRIAR
-- ============================================

-- Recriar função com SECURITY DEFINER se necessário
CREATE OR REPLACE FUNCTION sistemaretiradas.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Esta função bypassa RLS porque é SECURITY DEFINER
  -- Isso permite verificar se um usuário é admin sem causar recursão
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = user_id
    AND role = 'ADMIN'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- ⬅️ IMPORTANTE: SECURITY DEFINER bypassa RLS

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- ✅ A função deve existir e ter security_type = 'SECURITY DEFINER'
-- ✅ As políticas devem estar criadas corretamente
-- ✅ O login deve funcionar sem erro de recursão

