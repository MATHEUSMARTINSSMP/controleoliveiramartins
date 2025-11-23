-- Script SQL para permitir joins na tabela profiles
-- Execute este script no Supabase SQL Editor
-- Este script adiciona uma política que permite ver perfis de colaboradoras para joins

-- ============================================
-- ADICIONAR POLÍTICA PARA PERMITIR JOINS
-- ============================================

-- Política que permite ver perfis de COLABORADORAS quando fazendo joins
-- Isso é necessário para que queries como sales JOIN profiles funcionem
-- ⚠️ IMPORTANTE: Esta política NÃO verifica se o usuário é admin para evitar recursão
-- Ela permite que qualquer usuário autenticado veja perfis de colaboradoras
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

