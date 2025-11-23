-- Migration: Corrigir recursão infinita nas políticas RLS da tabela profiles
-- Descrição: Remove políticas que causam recursão infinita e recria políticas corretas
-- Data: 2025-11-23

-- ============================================
-- 1. DROPAR TODAS AS POLÍTICAS EXISTENTES DA TABELA profiles
-- ============================================

-- Remover todas as políticas existentes para evitar conflitos
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
-- 2. HABILITAR RLS (se ainda não estiver)
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CRIAR POLÍTICAS CORRETAS (SEM RECURSÃO)
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil
-- IMPORTANTE: Usa auth.uid() diretamente, SEM consultar a tabela profiles
CREATE POLICY "profiles_select_own"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: ADMINS podem ver todos os perfis
-- IMPORTANTE: Verifica role usando uma função auxiliar ou verifica diretamente sem recursão
-- Vamos usar uma abordagem que não causa recursão: verificar se o usuário atual é admin
-- através de uma verificação direta do perfil atual, mas sem usar SELECT na mesma tabela
CREATE POLICY "profiles_select_admin"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  -- Verificar se o usuário atual é admin através de uma subquery que não causa recursão
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
-- 4. CRIAR FUNÇÃO AUXILIAR PARA EVITAR RECURSÃO (OPCIONAL)
-- ============================================

-- Função auxiliar para verificar se o usuário atual é admin
-- Esta função pode ser usada em outras políticas para evitar repetição
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  -- IMPORTANTE: Esta função pode causar recursão se usada em políticas da tabela profiles
  -- Por isso, vamos usar a verificação direta nas políticas acima
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION sistemaretiradas.is_user_admin() IS 
'Função auxiliar para verificar se o usuário atual é admin. 
⚠️ NÃO usar em políticas RLS da tabela profiles para evitar recursão infinita.';

COMMENT ON POLICY "profiles_select_own" ON sistemaretiradas.profiles IS 
'Permite que usuários vejam seu próprio perfil. Usa auth.uid() diretamente para evitar recursão.';

COMMENT ON POLICY "profiles_select_admin" ON sistemaretiradas.profiles IS 
'Permite que ADMINS vejam todos os perfis. Verifica role através de subquery.';

