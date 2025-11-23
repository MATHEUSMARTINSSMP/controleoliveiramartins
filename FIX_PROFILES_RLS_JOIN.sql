-- Script SQL para permitir joins na tabela profiles
-- Execute este script no Supabase SQL Editor
-- Este script adiciona uma política que permite ver perfis de colaboradoras para joins

-- ============================================
-- ADICIONAR POLÍTICA PARA PERMITIR JOINS
-- ============================================

-- Política que permite ver perfis de COLABORADORAS quando fazendo joins
-- Isso é necessário para que queries como sales JOIN profiles funcionem
CREATE POLICY "profiles_select_colaboradoras_for_joins"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
  -- Permitir ver perfis de colaboradoras (para joins em outras tabelas)
  role = 'COLABORADORA'
  OR
  -- Permitir ver próprio perfil
  id = auth.uid()
  OR
  -- Permitir que admins vejam todos os perfis (se a função check_is_admin existir)
  (EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  ))
);

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
  AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- TESTE
-- ============================================

-- Testar se consegue fazer join (execute logado):
-- SELECT s.*, p.name as colaboradora_name
-- FROM sistemaretiradas.sales s
-- LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
-- LIMIT 5;

