-- ============================================================================
-- MIGRATION: Adicionar coluna tags na tabela clientes
-- Data: 2025-01-31
-- Descrição: Adiciona coluna tags (TEXT[]) para armazenar tags dos clientes
-- ============================================================================

-- Verificar se a tabela clientes existe (pode ser tiny_contacts ou outra)
-- Vamos adicionar em ambas as possíveis tabelas

-- Adicionar coluna tags na tabela tiny_contacts
ALTER TABLE sistemaretiradas.tiny_contacts
ADD COLUMN IF NOT EXISTS tags TEXT[];

COMMENT ON COLUMN sistemaretiradas.tiny_contacts.tags IS 'Array de tags para categorização e filtragem de clientes';

-- Adicionar coluna tags na tabela clientes (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'sistemaretiradas' 
               AND table_name = 'clientes') THEN
        ALTER TABLE sistemaretiradas.clientes
        ADD COLUMN IF NOT EXISTS tags TEXT[];
        
        COMMENT ON COLUMN sistemaretiradas.clientes.tags IS 'Array de tags para categorização e filtragem de clientes';
    END IF;
END $$;

-- Criar índice GIN para busca eficiente em arrays
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_tags ON sistemaretiradas.tiny_contacts USING GIN (tags);

