-- Migration: Create collaborator_off_days table
-- Description: Tabela para gerenciar folgas de colaboradoras e redistribuir metas automaticamente
-- Date: 2025-12-05

-- Criar tabela collaborator_off_days
CREATE TABLE IF NOT EXISTS sistemaretiradas.collaborator_off_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    data_folga DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: uma colaboradora só pode ter uma folga por data
    UNIQUE(colaboradora_id, data_folga, store_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_collaborator_off_days_colaboradora_id ON sistemaretiradas.collaborator_off_days(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_off_days_store_id ON sistemaretiradas.collaborator_off_days(store_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_off_days_data_folga ON sistemaretiradas.collaborator_off_days(data_folga);
CREATE INDEX IF NOT EXISTS idx_collaborator_off_days_store_data ON sistemaretiradas.collaborator_off_days(store_id, data_folga);

-- Comentários nas colunas
COMMENT ON TABLE sistemaretiradas.collaborator_off_days IS 'Tabela para gerenciar folgas de colaboradoras e redistribuir metas automaticamente';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.id IS 'ID único da folga';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.colaboradora_id IS 'ID da colaboradora que está de folga';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.store_id IS 'ID da loja da colaboradora';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.data_folga IS 'Data da folga (formato DATE)';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN sistemaretiradas.collaborator_off_days.updated_at IS 'Data de última atualização do registro';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.update_collaborator_off_days_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_collaborator_off_days_updated_at
    BEFORE UPDATE ON sistemaretiradas.collaborator_off_days
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_collaborator_off_days_updated_at();

