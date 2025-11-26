-- =============================================================================
-- Migration: Adicionar campo data_nascimento à tabela tiny_contacts
-- =============================================================================
-- Adiciona suporte para armazenar data de nascimento dos clientes do Tiny ERP
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar coluna data_nascimento se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_contacts' 
        AND column_name = 'data_nascimento'
    ) THEN
        ALTER TABLE tiny_contacts 
        ADD COLUMN data_nascimento DATE;
        
        RAISE NOTICE 'Coluna data_nascimento adicionada à tabela tiny_contacts';
    ELSE
        RAISE NOTICE 'Coluna data_nascimento já existe na tabela tiny_contacts';
    END IF;
END $$;

-- Criar índice para busca por data de nascimento (opcional, útil para relatórios)
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_data_nascimento 
ON tiny_contacts(data_nascimento) 
WHERE data_nascimento IS NOT NULL;

-- Comentário
COMMENT ON COLUMN tiny_contacts.data_nascimento IS 'Data de nascimento do cliente (para pessoas físicas)';

-- =============================================================================
-- RESUMO
-- =============================================================================
-- ✅ Coluna data_nascimento adicionada (se não existia)
-- ✅ Índice criado para otimizar buscas
-- =============================================================================

