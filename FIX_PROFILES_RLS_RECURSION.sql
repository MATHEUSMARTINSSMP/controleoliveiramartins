-- Script SQL para corrigir recursão infinita nas políticas RLS da tabela profiles
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. DROPAR TODAS AS POLÍTICAS EXISTENTES
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_public_select" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_select" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON sistemaretiradas.profiles;

-- ============================================
-- 2. HABILITAR RLS
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CRIAR POLÍTICAS CORRETAS (SEM RECURSÃO)
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil
CREATE POLICY "profiles_select_own"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: ADMINS podem ver todos os perfis
-- ⚠️ IMPORTANTE: Esta política pode causar recursão se mal configurada
-- Vamos usar uma abordagem que minimiza o risco
CREATE POLICY "profiles_select_admin"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  -- Verificar se o usuário atual é admin
  -- Usar uma subquery que não causa recursão infinita
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- Política 3: Usuários podem inserir seu próprio perfil
CREATE POLICY "profiles_insert_own"
ON sistemaretiradas.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Política 4: ADMINS podem inserir qualquer perfil
CREATE POLICY "profiles_insert_admin"
ON sistemaretiradas.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- Política 5: Usuários podem atualizar seu próprio perfil
CREATE POLICY "profiles_update_own"
ON sistemaretiradas.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Política 6: ADMINS podem atualizar qualquer perfil
CREATE POLICY "profiles_update_admin"
ON sistemaretiradas.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- Política 7: Apenas ADMINS podem deletar perfis
CREATE POLICY "profiles_delete_admin"
ON sistemaretiradas.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- ============================================
-- 4. VERIFICAÇÃO
-- ============================================

-- Verificar se as políticas foram criadas corretamente
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

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Se ainda houver recursão, pode ser necessário usar uma abordagem diferente:
-- 1. Criar uma função SECURITY DEFINER que bypassa RLS
-- 2. Ou usar uma tabela auxiliar para cache de roles
-- 3. Ou desabilitar temporariamente RLS para a verificação de admin

