-- Script SQL para corrigir políticas RLS da tabela whatsapp_recipients
-- Execute este script no Supabase SQL Editor
-- Permite que usuários LOJA vejam recipients do admin da sua loja

-- ============================================
-- 1. VERIFICAR POLÍTICAS ATUAIS
-- ============================================

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'whatsapp_recipients'
ORDER BY policyname;

-- ============================================
-- 2. ADICIONAR POLÍTICA PARA USUÁRIOS LOJA
-- ============================================

-- Política que permite que usuários LOJA vejam recipients do admin da sua loja
-- A lógica: usuário LOJA -> busca admin_id da sua loja -> vê recipients desse admin
-- ⚠️ IMPORTANTE: Esta política NÃO deve substituir as políticas existentes, apenas adicionar permissão
CREATE POLICY "LOJA users can view admin recipients"
ON sistemaretiradas.whatsapp_recipients
FOR SELECT
TO authenticated
USING (
  -- Permitir se o usuário é LOJA E o admin_id do recipient é o admin da loja do usuário
  -- IMPORTANTE: Verificar se store_default é UUID antes de fazer JOIN
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON s.id::text = p.store_default::text
    WHERE p.id = auth.uid()
    AND p.role::text = 'LOJA'
    AND p.store_default IS NOT NULL
    -- Verificar se store_default é um UUID válido (não é nome de loja)
    AND p.store_default::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND s.admin_id IS NOT NULL
    AND s.admin_id = sistemaretiradas.whatsapp_recipients.admin_id
  )
);

-- ============================================
-- 3. VERIFICAR POLÍTICAS APÓS ALTERAÇÃO
-- ============================================

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'whatsapp_recipients'
ORDER BY policyname;

-- ============================================
-- 4. TESTE MANUAL (OPCIONAL)
-- ============================================

-- Teste 1: Usuário LOJA deve ver recipients do admin da sua loja
-- SELECT wr.*
-- FROM sistemaretiradas.whatsapp_recipients wr
-- JOIN sistemaretiradas.stores s ON s.admin_id = wr.admin_id
-- JOIN sistemaretiradas.profiles p ON p.store_default = s.id
-- WHERE p.id = auth.uid()
--   AND p.role = 'LOJA';

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- ✅ Esta política permite que usuários LOJA vejam recipients do admin da sua loja
-- ✅ Usuários ADMIN continuam vendo todos (via is_user_admin())
-- ✅ Usuários podem ver seus próprios recipients (via admin_id = auth.uid())
-- ✅ A política verifica:
--    1. Se o usuário é LOJA
--    2. Se o admin_id do recipient é o admin da loja do usuário (store_default -> stores.admin_id)
-- ✅ SEM RECURSÃO: Usa EXISTS com JOIN direto, não consulta whatsapp_recipients recursivamente

