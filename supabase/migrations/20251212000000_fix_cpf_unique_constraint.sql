-- ============================================================================
-- MIGRATION: Corrigir constraint única de CPF para ser por loja
-- Data: 2025-12-12
-- Descrição: Altera a unicidade do CPF para ser composta (cpf + store_id),
-- permitindo que o mesmo CPF exista em lojas diferentes.
-- ============================================================================

-- Remover o índice único global anterior
DROP INDEX IF EXISTS sistemaretiradas.idx_crm_contacts_cpf_unique;

-- Criar novo índice único composto (CPF + Store ID)
-- Garante que o mesmo CPF não se repita NA MESMA LOJA, mas permite em lojas diferentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_cpf_store_unique 
ON sistemaretiradas.crm_contacts(cpf, store_id) 
WHERE cpf IS NOT NULL;

COMMENT ON INDEX sistemaretiradas.idx_crm_contacts_cpf_store_unique IS 'Garante unicidade de CPF por loja';
