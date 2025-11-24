-- =============================================================================
-- POLÍTICA RLS: Colaboradora pode cancelar seu próprio adiantamento PENDENTE
-- =============================================================================
-- Esta política permite que colaboradoras atualizem o status de seus próprios
-- adiantamentos de PENDENTE para CANCELADO.
-- 
-- REQUISITOS:
-- 1. O adiantamento deve pertencer à colaboradora (colaboradora_id = auth.uid())
-- 2. O status atual deve ser PENDENTE
-- 3. O novo status deve ser CANCELADO
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Remover política antiga se existir (caso tenha sido criada anteriormente)
DROP POLICY IF EXISTS "colab_cancel_own_adiantamento" ON adiantamentos;

-- Criar política de UPDATE para colaboradora cancelar seu próprio adiantamento
CREATE POLICY "colab_cancel_own_adiantamento"
ON adiantamentos
FOR UPDATE
USING (
  -- Verificar se o adiantamento pertence à colaboradora
  colaboradora_id = auth.uid()
  -- Verificar se o status atual é PENDENTE (só pode cancelar pendentes)
  AND status = 'PENDENTE'
)
WITH CHECK (
  -- Verificar que o adiantamento ainda pertence à colaboradora após o update
  colaboradora_id = auth.uid()
  -- Verificar que o novo status é CANCELADO
  AND status = 'CANCELADO'
);

-- =============================================================================
-- VERIFICAÇÃO: Listar políticas atuais de adiantamentos
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'adiantamentos'
ORDER BY policyname;

-- =============================================================================
-- NOTA IMPORTANTE:
-- =============================================================================
-- Se o erro persistir sobre o enum "CANCELADO" não existir, você também precisa
-- adicionar "CANCELADO" ao enum status_adiantamento no banco de dados.
-- 
-- Para verificar o enum atual:
-- SELECT unnest(enum_range(NULL::sistemaretiradas.status_adiantamento));
--
-- Para adicionar CANCELADO ao enum (se necessário):
-- ALTER TYPE sistemaretiradas.status_adiantamento ADD VALUE 'CANCELADO';
-- =============================================================================

