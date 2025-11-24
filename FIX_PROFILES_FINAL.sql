-- SCRIPT FINAL E DEFINITIVO (LIMPEZA TOTAL)
-- Execute este script COMPLETO no SQL Editor do Supabase

-- 1. Matar queries travadas
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
    END LOOP;
END $$;

-- 2. Remover TODAS as políticas explicitamente (para garantir)
DROP POLICY IF EXISTS "profiles_select_own" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_select_loja" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON sistemaretiradas.profiles;
-- Remover políticas antigas/legado também
DROP POLICY IF EXISTS "profiles_select_all" ON sistemaretiradas.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON sistemaretiradas.profiles;

-- 3. Remover a função e dependências restantes
DROP FUNCTION IF EXISTS sistemaretiradas.get_user_role() CASCADE;

-- 4. Recriar função SECURITY DEFINER (Blindada)
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

-- 6. Garantir RLS
ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

SELECT 'SUCESSO: Limpeza total realizada e políticas recriadas.' as status;
