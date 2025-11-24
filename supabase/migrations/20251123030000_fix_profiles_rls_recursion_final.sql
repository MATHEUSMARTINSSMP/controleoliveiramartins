-- Migration: Corrigir recursão infinita nas políticas RLS da tabela profiles (VERSÃO CORRIGIDA COM SECURITY DEFINER)
-- Descrição: Remove políticas que causam recursão infinita e recria políticas corretas usando função SECURITY DEFINER
-- Data: 2025-11-23

-- ============================================
-- 1. DROPAR TODAS AS POLÍTICAS EXISTENTES DA TABELA profiles
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
          AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.profiles', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 2. CRIAR FUNÇÃO SECURITY DEFINER (ESSENCIAL PARA EVITAR RECURSÃO)
-- ============================================

-- Remove função anterior se existir
DROP FUNCTION IF EXISTS sistemaretiradas.get_user_role();

-- Cria função que roda com permissões de admin (bypassing RLS)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Importante: roda com permissões do dono da função
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role::text INTO user_role
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(user_role, '');
END;
$$;

-- ============================================
-- 3. HABILITAR RLS
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CRIAR POLÍTICAS CORRETAS
-- ============================================

-- Política 1: Usuários podem ver seu próprio perfil (Simples, sem função)
CREATE POLICY "profiles_select_own" 
ON sistemaretiradas.profiles
FOR SELECT
USING (auth.uid() = id);

-- Política 2: ADMINS podem ver todos os perfis (Usa função SECURITY DEFINER)
CREATE POLICY "profiles_select_admin" 
ON sistemaretiradas.profiles
FOR SELECT
USING (sistemaretiradas.get_user_role() = 'ADMIN');

-- Política 3: LOJA podem ver todos os perfis (Usa função SECURITY DEFINER)
CREATE POLICY "profiles_select_loja" 
ON sistemaretiradas.profiles
FOR SELECT
USING (sistemaretiradas.get_user_role() = 'LOJA');

-- Política 4: UPDATE Próprio
CREATE POLICY "profiles_update_own" 
ON sistemaretiradas.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política 5: UPDATE Admin
CREATE POLICY "profiles_update_admin" 
ON sistemaretiradas.profiles
FOR UPDATE
USING (sistemaretiradas.get_user_role() = 'ADMIN')
WITH CHECK (sistemaretiradas.get_user_role() = 'ADMIN');

-- Política 6: INSERT Admin (Geralmente insert é feito via trigger no auth.users, mas ok ter aqui)
CREATE POLICY "profiles_insert_admin" 
ON sistemaretiradas.profiles
FOR INSERT
WITH CHECK (sistemaretiradas.get_user_role() = 'ADMIN');

-- Política 7: DELETE Admin
CREATE POLICY "profiles_delete_admin" 
ON sistemaretiradas.profiles
FOR DELETE
USING (sistemaretiradas.get_user_role() = 'ADMIN');
