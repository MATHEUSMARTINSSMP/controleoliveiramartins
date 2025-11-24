-- =============================================================================
-- SOLUÇÃO COMPLETA: Permitir colaboradora cancelar adiantamento PENDENTE
-- =============================================================================
-- ⚠️ IMPORTANTE: Devido a limitação do PostgreSQL, este script está dividido
-- em duas partes que devem ser executadas separadamente:
--
-- 1. Execute PRIMEIRO: PARTE1_ADICIONAR_ENUM_CANCELADO.sql
--    - Aguarde o commit automático (ou faça COMMIT manual)
--
-- 2. Execute DEPOIS: PARTE2_CRIAR_POLITICA_RLS.sql
--    - Só execute após o commit da Parte 1
--
-- OU use os scripts separados: PARTE1_*.sql e PARTE2_*.sql
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- PARTE 1: DESCOBRIR E ATUALIZAR ENUM status_adiantamento
-- =============================================================================
-- IMPORTANTE: Esta parte deve ser executada PRIMEIRO e fazer COMMIT
-- antes de criar a política RLS que usa o novo valor

-- Primeiro, vamos descobrir qual é o enum correto usado pela tabela adiantamentos
DO $$
DECLARE
  v_enum_schema TEXT;
  v_enum_name TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Buscar o tipo da coluna status
  SELECT 
    udt_schema,
    udt_name
  INTO 
    v_enum_schema,
    v_enum_name
  FROM information_schema.columns
  WHERE table_schema = 'sistemaretiradas'
    AND table_name = 'adiantamentos'
    AND column_name = 'status';
  
  IF v_enum_schema IS NULL OR v_enum_name IS NULL THEN
    RAISE EXCEPTION 'Não foi possível encontrar o tipo da coluna status na tabela adiantamentos';
  END IF;
  
  RAISE NOTICE 'Enum encontrado: %.%', v_enum_schema, v_enum_name;
  
  -- Verificar se CANCELADO já existe
  SELECT EXISTS (
    SELECT 1 
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = v_enum_schema
      AND t.typname = v_enum_name
      AND e.enumlabel = 'CANCELADO'
  ) INTO v_exists;
  
  -- Se não existir, adicionar
  IF NOT v_exists THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', v_enum_schema, v_enum_name, 'CANCELADO');
    RAISE NOTICE 'CANCELADO adicionado ao enum %.%', v_enum_schema, v_enum_name;
    RAISE NOTICE 'IMPORTANTE: Faça COMMIT antes de continuar para a Parte 2!';
  ELSE
    RAISE NOTICE 'CANCELADO já existe no enum %.%', v_enum_schema, v_enum_name;
  END IF;
END $$;

-- =============================================================================
-- FAZER COMMIT AQUI ANTES DE CONTINUAR!
-- =============================================================================
-- No Supabase SQL Editor, o COMMIT é automático após cada bloco,
-- mas se estiver em uma transação manual, execute: COMMIT;
-- =============================================================================

-- =============================================================================
-- PARTE 2: CRIAR POLÍTICA RLS PARA CANCELAR ADIANTAMENTO
-- =============================================================================
-- IMPORTANTE: Execute esta parte APÓS fazer COMMIT da Parte 1
-- O novo valor CANCELADO precisa estar commitado antes de ser usado na política
-- =============================================================================

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
-- PARTE 3: VERIFICAÇÃO FINAL
-- =============================================================================

-- Verificar valores do enum (mostra todos os valores disponíveis)
SELECT 
  e.enumlabel as valor_enum,
  e.enumsortorder as ordem
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
JOIN information_schema.columns c ON c.udt_schema = n.nspname AND c.udt_name = t.typname
WHERE c.table_schema = 'sistemaretiradas'
  AND c.table_name = 'adiantamentos'
  AND c.column_name = 'status'
ORDER BY e.enumsortorder;

-- Verificar políticas criadas
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

-- =============================================================================
-- RESUMO
-- =============================================================================
-- Após executar este script:
-- 1. O enum status_adiantamento terá o valor CANCELADO
-- 2. A política RLS permitirá que colaboradoras cancelem seus próprios adiantamentos PENDENTES
-- 3. A colaboradora só poderá alterar status de PENDENTE para CANCELADO
-- 4. Não poderá cancelar adiantamentos de outras colaboradoras
-- 5. Não poderá cancelar adiantamentos que já não estão PENDENTES
-- =============================================================================


