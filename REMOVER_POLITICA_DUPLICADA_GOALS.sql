-- Script para remover política duplicada da tabela goals
-- Execute este script no Supabase SQL Editor

-- ============================================
-- REMOVER POLÍTICA DUPLICADA
-- ============================================

-- Remover a política antiga "LOJA users can view store goals"
-- A política "LOJA can manage goals" já cobre isso de forma mais simples
DROP POLICY IF EXISTS "LOJA users can view store goals" ON sistemaretiradas.goals;

-- ============================================
-- VERIFICAR POLÍTICAS RESTANTES
-- ============================================

-- Verificar políticas atuais da tabela goals
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'goals'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- Deve ter apenas 3 políticas:
-- 1. ADMIN can do everything on goals (ALL)
-- 2. LOJA can manage goals (ALL)
-- 3. COLABORADORA can view own goals (SELECT)
-- 
-- A política duplicada "LOJA users can view store goals" foi removida

