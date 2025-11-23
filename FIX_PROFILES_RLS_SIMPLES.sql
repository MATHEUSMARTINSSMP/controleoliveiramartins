-- Script SQL SIMPLIFICADO para corrigir recursão infinita
-- Execute este script PRIMEIRO no Supabase SQL Editor
-- Esta versão remove a política que causa recursão

-- ============================================
-- 1. DROPAR TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- Remover TODAS as políticas da tabela profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'sistemaretiradas' AND tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON sistemaretiradas.profiles';
    END LOOP;
END $$;

-- ============================================
-- 2. HABILITAR RLS
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CRIAR APENAS A POLÍTICA ESSENCIAL (SEM RECURSÃO)
-- ============================================

-- Política SIMPLES: Usuários podem ver e atualizar seu próprio perfil
-- Esta política NÃO causa recursão porque usa auth.uid() diretamente
CREATE POLICY "profiles_own_access"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================
-- 4. CRIAR FUNÇÃO SECURITY DEFINER PARA ADMINS
-- ============================================

-- Função que bypassa RLS para verificar se usuário é admin
-- Esta função pode ser usada em outras tabelas, mas NÃO na tabela profiles
CREATE OR REPLACE FUNCTION sistemaretiradas.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
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
-- 5. POLÍTICA PARA ADMINS (USANDO FUNÇÃO SECURITY DEFINER)
-- ============================================

-- Política que permite admins verem todos os perfis
-- Usa a função SECURITY DEFINER que bypassa RLS
CREATE POLICY "profiles_admin_access"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (sistemaretiradas.check_is_admin(auth.uid()))
WITH CHECK (sistemaretiradas.check_is_admin(auth.uid()));

-- ============================================
-- 6. VERIFICAÇÃO
-- ============================================

-- Testar se consegue ver o próprio perfil
-- Execute esta query logado para testar:
-- SELECT * FROM sistemaretiradas.profiles WHERE id = auth.uid();

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

