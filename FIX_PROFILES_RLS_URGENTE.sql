-- Script SQL URGENTE para corrigir recursão infinita
-- Execute este script IMEDIATAMENTE no Supabase SQL Editor
-- Esta versão remove TODAS as políticas e cria apenas a essencial

-- ============================================
-- 1. DROPAR TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- Remover TODAS as políticas da tabela profiles usando um loop
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
-- 2. HABILITAR RLS
-- ============================================

ALTER TABLE sistemaretiradas.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CRIAR APENAS A POLÍTICA BÁSICA (SEM RECURSÃO)
-- ============================================

-- Política SIMPLES: Usuários podem ver, inserir e atualizar seu próprio perfil
-- Esta política NÃO causa recursão porque usa auth.uid() diretamente
-- NÃO consulta a tabela profiles, então não há recursão
CREATE POLICY "profiles_own_access"
ON sistemaretiradas.profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Esta solução permite que:
-- ✅ Usuários vejam e atualizem seu próprio perfil (resolve o login)
-- ❌ Admins NÃO podem ver todos os perfis (temporariamente)
-- 
-- Para permitir que admins vejam todos os perfis SEM causar recursão,
-- você precisará usar uma das seguintes abordagens:
-- 1. Desabilitar RLS temporariamente para admins (não recomendado)
-- 2. Usar uma tabela auxiliar para cache de roles
-- 3. Usar uma função SECURITY DEFINER que bypassa RLS
-- 4. Criar uma view materializada com roles

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se a política foi criada
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'profiles';

-- Testar login agora - deve funcionar!

