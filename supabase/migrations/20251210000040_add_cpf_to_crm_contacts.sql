-- ============================================================================
-- MIGRATION: Adicionar campo CPF na tabela crm_contacts
-- Data: 2025-12-10
-- Descrição: Adiciona campo CPF para identificação única de clientes
-- ============================================================================

-- Adicionar coluna CPF na tabela crm_contacts
ALTER TABLE sistemaretiradas.crm_contacts
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Criar índice único para CPF (permitir NULL, mas garantir unicidade quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_cpf_unique 
ON sistemaretiradas.crm_contacts(cpf) 
WHERE cpf IS NOT NULL;

-- Criar índice para busca por CPF
CREATE INDEX IF NOT EXISTS idx_crm_contacts_cpf 
ON sistemaretiradas.crm_contacts(cpf);

COMMENT ON COLUMN sistemaretiradas.crm_contacts.cpf IS 'CPF do cliente (identificador único, normalizado sem pontos e traços)';

