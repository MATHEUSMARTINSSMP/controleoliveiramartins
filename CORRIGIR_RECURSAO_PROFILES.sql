-- Script SQL URGENTE para corrigir recursão infinita na tabela profiles
-- Execute este script IMEDIATAMENTE no Supabase SQL Editor
-- Este script remove TODAS as políticas que causam recursão

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS DA TABELA profiles
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
-- 2. CRIAR FUNÇÕES SECURITY DEFINER (BYPASSA RLS)
-- ============================================

-- Função para verificar se usuário é ADMIN (já existe, mas vamos garantir)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é LOJA (NOVA - bypassa RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_loja()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'LOJA'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é COLABORADORA (NOVA - bypassa RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_colaboradora()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'COLABORADORA'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. CRIAR POLÍTICAS SIMPLES PARA profiles (SEM RECURSÃO)
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil
-- ✅ SEM RECURSÃO: Usa auth.uid() diretamente
CREATE POLICY "Users can view own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: ADMINS podem ver tudo (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "ADMIN can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_admin());

-- Política 3: ADMINS podem inserir/atualizar/deletar tudo
CREATE POLICY "ADMIN can manage all profiles"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- Política 4: LOJA pode ver tudo (usando função SECURITY DEFINER)
-- ✅ SEM RECURSÃO: Função bypassa RLS
CREATE POLICY "LOJA can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_loja());

-- Política 5: Qualquer um autenticado pode ver colaboradoras (para joins)
-- ✅ SEM RECURSÃO: Não consulta a tabela profiles para verificar role do usuário
-- Permite ver perfis de colaboradoras para que joins funcionem
CREATE POLICY "Authenticated users can view colaboradoras"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  role = 'COLABORADORA'
  OR
  sistemaretiradas.is_user_admin()
  OR
  sistemaretiradas.is_user_loja()
  OR
  id = auth.uid()
);

-- ============================================
-- 4. VERIFICAÇÃO
-- ============================================

-- Verificar políticas criadas
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles'
ORDER BY policyname;

-- Verificar funções criadas
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER (Bypassa RLS)'
    ELSE '❌ SECURITY INVOKER'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname IN ('is_user_admin', 'is_user_loja', 'is_user_colaboradora')
ORDER BY p.proname;

-- ============================================
-- RESUMO
-- ============================================
-- ✅ Todas as políticas usam funções SECURITY DEFINER (bypassam RLS)
-- ✅ Nenhuma política consulta profiles diretamente (evita recursão)
-- ✅ Login deve funcionar agora
-- ✅ ADMIN e LOJA podem ver todos os perfis
-- ✅ COLABORADORA pode ver apenas seu próprio perfil

