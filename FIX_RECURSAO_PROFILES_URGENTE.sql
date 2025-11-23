-- Script SQL URGENTE para corrigir recursão infinita na tabela profiles
-- Execute este script IMEDIATAMENTE no Supabase SQL Editor
-- Remove TODAS as políticas e cria apenas as essenciais SEM RECURSÃO

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS DA TABELA profiles
-- ============================================

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
-- 2. CRIAR/ATUALIZAR FUNÇÕES SECURITY DEFINER
-- ============================================

-- Função ADMIN (já existe)
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

-- Função LOJA (nova)
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

-- Função COLABORADORA (nova)
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
-- 3. CRIAR POLÍTICAS SIMPLES (SEM RECURSÃO)
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil
-- ✅ SEM RECURSÃO: Usa auth.uid() diretamente
CREATE POLICY "users_own_profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: ADMINS podem tudo
-- ✅ SEM RECURSÃO: Função SECURITY DEFINER bypassa RLS
CREATE POLICY "admins_all_profiles"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (sistemaretiradas.is_user_admin())
WITH CHECK (sistemaretiradas.is_user_admin());

-- Política 3: LOJA pode ver tudo
-- ✅ SEM RECURSÃO: Função SECURITY DEFINER bypassa RLS
CREATE POLICY "loja_view_all_profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_loja());

-- Política 4: Qualquer um autenticado pode ver colaboradoras (para joins)
-- ✅ SEM RECURSÃO: Verifica role do REGISTRO, não do usuário
-- Isso permite joins funcionarem sem causar recursão
CREATE POLICY "view_colaboradoras"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (role = 'COLABORADORA');

-- ============================================
-- 4. VERIFICAÇÃO
-- ============================================

-- Verificar políticas criadas
SELECT 
  policyname,
  cmd,
  substring(qual, 1, 100) as qual_preview
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- RESUMO
-- ============================================
-- ✅ 4 políticas criadas, todas SEM RECURSÃO
-- ✅ Política 1: Usuário vê próprio perfil (auth.uid() direto)
-- ✅ Política 2: Admin vê tudo (função SECURITY DEFINER)
-- ✅ Política 3: LOJA vê tudo (função SECURITY DEFINER)
-- ✅ Política 4: Todos veem colaboradoras (verifica role do registro, não do usuário)
-- ✅ Login deve funcionar agora!

