-- SCRIPT DE EMERGÊNCIA: MATAR PROCESSOS TRAVADOS E REFAZER POLÍTICAS
-- Execute este script COMPLETO no SQL Editor do Supabase

-- 1. Matar queries travadas que podem estar bloqueando a tabela
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT pid, query 
        FROM pg_stat_activity 
        WHERE pid <> pg_backend_pid()
          AND state = 'active' 
          AND (query ILIKE '%profiles%' OR query ILIKE '%get_user_role%')
    LOOP
        PERFORM pg_terminate_backend(r.pid);
        RAISE NOTICE 'Processo morto: %', r.query;
    END LOOP;
END $$;

-- 2. Remover a função conflituosa (garantindo limpeza)
DROP FUNCTION IF EXISTS sistemaretiradas.get_user_role();

-- 3. Remover TODAS as políticas da tabela profiles (para não sobrar lixo)
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
        RAISE NOTICE 'Política removida: %', r.policyname;
    END LOOP;
END $$;

-- 4. Recriar função SECURITY DEFINER (Blindada contra recursão)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 5. Recriar Políticas Limpas

-- Leitura: Próprio usuário
CREATE POLICY "profiles_select_own" 
ON sistemaretiradas.profiles FOR SELECT
USING (auth.uid() = id);

-- Leitura: Admin (via função segura)
CREATE POLICY "profiles_select_admin" 
ON sistemaretiradas.profiles FOR SELECT
USING (sistemaretiradas.get_user_role() = 'ADMIN');

-- Leitura: Loja (via função segura)
CREATE POLICY "profiles_select_loja" 
ON sistemaretiradas.profiles FOR SELECT
USING (sistemaretiradas.get_user_role() = 'LOJA');

-- Update: Próprio usuário
CREATE POLICY "profiles_update_own" 
ON sistemaretiradas.profiles FOR UPDATE
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Update: Admin
CREATE POLICY "profiles_update_admin" 
ON sistemaretiradas.profiles FOR UPDATE
USING (sistemaretiradas.get_user_role() = 'ADMIN');

-- Insert: Admin
CREATE POLICY "profiles_insert_admin" 
ON sistemaretiradas.profiles FOR INSERT
WITH CHECK (sistemaretiradas.get_user_role() = 'ADMIN');

-- Delete: Admin
CREATE POLICY "profiles_delete_admin" 
ON sistemaretiradas.profiles FOR DELETE
USING (sistemaretiradas.get_user_role() = 'ADMIN');

-- 6. Garantir que RLS está ativo
ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Confirmação
SELECT 'CORREÇÃO APLICADA COM SUCESSO. PROCESSOS TRAVADOS FORAM MORTOS.' as status;
