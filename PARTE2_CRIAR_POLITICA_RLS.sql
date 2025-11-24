-- =============================================================================
-- PARTE 2: CRIAR POLÍTICA RLS PARA CANCELAR ADIANTAMENTO
-- =============================================================================
-- Execute este script DEPOIS de executar PARTE1_ADICIONAR_ENUM_CANCELADO.sql
-- e aguardar o commit automático (ou fazer COMMIT manual)
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "colab_cancel_own_adiantamento" ON adiantamentos;

-- Criar política de UPDATE para colaboradora cancelar seu próprio adiantamento
-- Esta política permite:
-- - Colaboradora atualizar apenas seus próprios adiantamentos
-- - Apenas se o status atual for PENDENTE
-- - Apenas para mudar para CANCELADO
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
-- VERIFICAÇÃO: Listar política criada
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operacao,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual::text
    ELSE 'Sem USING'
  END as condicao_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check::text
    ELSE 'Sem WITH CHECK'
  END as condicao_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'adiantamentos'
  AND policyname = 'colab_cancel_own_adiantamento';

