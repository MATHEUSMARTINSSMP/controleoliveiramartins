-- Script para verificar e corrigir políticas RLS da tabela goals
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR POLÍTICAS ATUAIS DA TABELA goals
-- ============================================

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
-- 2. VERIFICAR SE LOJA PODE VER GOALS DA SUA LOJA
-- ============================================

-- Verificar se há política que permite LOJA ver goals da sua loja
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'goals'
  AND policyname LIKE '%LOJA%'
  OR qual LIKE '%LOJA%'
  OR qual LIKE '%store_default%';

-- ============================================
-- 3. CRIAR/ATUALIZAR POLÍTICA PARA LOJA VER GOALS DA SUA LOJA
-- ============================================

-- Remover política existente se houver
DROP POLICY IF EXISTS "LOJA users can view store goals" ON sistemaretiradas.goals;

-- Criar política que permite usuários LOJA verem goals da sua loja
CREATE POLICY "LOJA users can view store goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
  -- Permitir se o usuário é LOJA E o store_id do goal é o store_default do usuário
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role::text = 'LOJA'
    AND p.store_default IS NOT NULL
    -- Verificar se store_default é UUID válido
    AND p.store_default::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND p.store_default::text = sistemaretiradas.goals.store_id::text
  )
);

-- ============================================
-- 4. VERIFICAR POLÍTICAS APÓS ALTERAÇÃO
-- ============================================

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
-- 5. TESTE MANUAL (OPCIONAL)
-- ============================================

-- Teste: Usuário LOJA deve ver goals da sua loja
-- SELECT g.*
-- FROM sistemaretiradas.goals g
-- JOIN sistemaretiradas.profiles p ON p.store_default::text = g.store_id::text
-- WHERE p.id = auth.uid()
--   AND p.role = 'LOJA'
--   AND g.tipo = 'MENSAL';

