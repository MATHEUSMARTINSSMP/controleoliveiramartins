-- Migration: Adicionar colunas de período (data início e data fim) na tabela bonuses
-- Isso permite que os cálculos de indicadores sejam feitos apenas no período de vigência do bônus

-- Verificar se as colunas já existem antes de criar
DO $$
BEGIN
    -- Adicionar periodo_data_inicio se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'bonuses' 
        AND column_name = 'periodo_data_inicio'
    ) THEN
        ALTER TABLE sistemaretiradas.bonuses 
        ADD COLUMN periodo_data_inicio DATE;
        
        COMMENT ON COLUMN sistemaretiradas.bonuses.periodo_data_inicio IS 'Data de início do período de vigência do bônus. Vendas antes desta data não serão consideradas no cálculo.';
    END IF;

    -- Adicionar periodo_data_fim se não existir
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'bonuses' 
        AND column_name = 'periodo_data_fim'
    ) THEN
        ALTER TABLE sistemaretiradas.bonuses 
        ADD COLUMN periodo_data_fim DATE;
        
        COMMENT ON COLUMN sistemaretiradas.bonuses.periodo_data_fim IS 'Data de término do período de vigência do bônus. Vendas após esta data não serão consideradas no cálculo.';
    END IF;
END $$;

-- Criar índices para melhorar performance das queries que filtram por período
CREATE INDEX IF NOT EXISTS idx_bonuses_periodo_data_inicio 
ON sistemaretiradas.bonuses(periodo_data_inicio) 
WHERE periodo_data_inicio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bonuses_periodo_data_fim 
ON sistemaretiradas.bonuses(periodo_data_fim) 
WHERE periodo_data_fim IS NOT NULL;

