-- Script SQL COMPLETO para refazer todas as políticas RLS da tabela profiles
-- Execute este script no Supabase SQL Editor
-- Este script remove TODAS as políticas existentes e recria do zero

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- Remover TODAS as políticas da tabela profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'profiles'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.profiles';
    END LOOP;
END $$;

-- ============================================
-- 2. REMOVER FUNÇÕES EXISTENTES (SE HOUVER)
-- ============================================

DROP FUNCTION IF EXISTS sistemaretiradas.check_is_admin(UUID);
DROP FUNCTION IF EXISTS sistemaretiradas.is_user_admin();

-- ============================================
-- 3. HABILITAR RLS
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CRIAR FUNÇÃO SECURITY DEFINER PARA VERIFICAR ADMIN
-- ============================================

-- Função que bypassa RLS para verificar se um usuário é admin
-- SECURITY DEFINER faz com que a função execute com privilégios do criador
-- Isso evita recursão infinita ao verificar se um usuário é admin
CREATE OR REPLACE FUNCTION sistemaretiradas.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Esta função bypassa RLS porque é SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = user_id
    AND role = 'ADMIN'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. CRIAR POLÍTICAS (SEM RECURSÃO)
-- ============================================

-- POLÍTICA 1: Usuários podem ver e atualizar seu próprio perfil
-- ✅ SEM RECURSÃO: Usa auth.uid() diretamente
CREATE POLICY "profiles_own_access"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- POLÍTICA 2: Qualquer usuário autenticado pode ver perfis de COLABORADORAS
-- ✅ SEM RECURSÃO: Verifica role diretamente, não consulta profiles
-- Esta política é necessária para joins funcionarem (ex: sales JOIN profiles)
CREATE POLICY "profiles_select_colaboradoras"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (role = 'COLABORADORA');

-- POLÍTICA 3: Qualquer usuário autenticado pode ver perfis de LOJA
-- ✅ SEM RECURSÃO: Verifica role diretamente
CREATE POLICY "profiles_select_loja"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (role = 'LOJA');

-- POLÍTICA 4: ADMINS podem ver todos os perfis
-- ✅ SEM RECURSÃO: Usa função SECURITY DEFINER que bypassa RLS
CREATE POLICY "profiles_admin_select_all"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.check_is_admin(auth.uid()));

-- POLÍTICA 5: ADMINS podem inserir qualquer perfil
CREATE POLICY "profiles_admin_insert"
ON sistemaretiradas.profiles
FOR INSERT
TO authenticated
WITH CHECK (sistemaretiradas.check_is_admin(auth.uid()));

-- POLÍTICA 6: ADMINS podem atualizar qualquer perfil
CREATE POLICY "profiles_admin_update"
ON sistemaretiradas.profiles
FOR UPDATE
TO authenticated
USING (sistemaretiradas.check_is_admin(auth.uid()))
WITH CHECK (sistemaretiradas.check_is_admin(auth.uid()));

-- POLÍTICA 7: ADMINS podem deletar qualquer perfil
CREATE POLICY "profiles_admin_delete"
ON sistemaretiradas.profiles
FOR DELETE
TO authenticated
USING (sistemaretiradas.check_is_admin(auth.uid()));

-- ============================================
-- 6. VERIFICAÇÃO
-- ============================================

-- Verificar todas as políticas criadas
SELECT 
  policyname,
  cmd as command,
  CASE 
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%profiles%' THEN '✅ Direto (sem recursão)'
    WHEN qual LIKE '%role%' AND qual NOT LIKE '%profiles%' THEN '✅ Verifica role diretamente (sem recursão)'
    WHEN qual LIKE '%check_is_admin%' THEN '✅ Usa função SECURITY DEFINER (sem recursão)'
    ELSE '⚠️ Verificar'
  END as recursion_check,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- 7. VERIFICAR FUNÇÃO
-- ============================================

-- Verificar se a função foi criada corretamente
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER (Bypassa RLS)'
    ELSE '❌ SECURITY INVOKER (NÃO bypassa RLS)'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'check_is_admin';

-- ============================================
-- 8. TESTE MANUAL (OPCIONAL)
-- ============================================

-- Teste 1: Ver próprio perfil (execute logado)
-- SELECT * FROM sistemaretiradas.profiles WHERE id = auth.uid();

-- Teste 2: Ver colaboradoras (execute logado)
-- SELECT * FROM sistemaretiradas.profiles WHERE role = 'COLABORADORA';

-- Teste 3: Fazer join com sales (execute logado)
-- SELECT s.*, p.name as colaboradora_name
-- FROM sistemaretiradas.sales s
-- LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
-- LIMIT 5;

-- ============================================
-- RESUMO
-- ============================================
-- ✅ Política 1: Usuários veem próprio perfil (sem recursão)
-- ✅ Política 2: Todos veem colaboradoras (para joins - sem recursão)
-- ✅ Política 3: Todos veem lojas (sem recursão)
-- ✅ Política 4-7: Admins podem tudo (usando função SECURITY DEFINER - sem recursão)
-- 
-- NENHUMA política causa recursão infinita porque:
-- - Políticas 1-3 verificam auth.uid() ou role diretamente
-- - Políticas 4-7 usam função SECURITY DEFINER que bypassa RLS

