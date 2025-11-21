-- Migration: Add support for weekly bonus types (META_SEMANAL and SUPER_META_SEMANAL)
-- This migration ensures the bonuses table can support weekly bonus conditions
-- Based on the real structure: nome, descricao, tipo, tipo_condicao, meta_minima_percentual, etc.

-- Add store_id column if it doesn't exist (for store-specific bonuses)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'bonuses' 
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE sistemaretiradas.bonuses
        ADD COLUMN store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_bonuses_store_id 
        ON sistemaretiradas.bonuses(store_id);
        
        RAISE NOTICE 'Added store_id column to bonuses table';
    ELSE
        RAISE NOTICE 'store_id column already exists in bonuses table';
    END IF;
END $$;

-- Ensure tipo_condicao column exists and supports weekly bonus types
-- Based on user's example, tipo_condicao already exists with values like 'PERCENTUAL_META'
-- We just need to ensure it can accept META_SEMANAL and SUPER_META_SEMANAL

-- Verify and update tipo_condicao constraint if needed
-- Note: The column should accept: PERCENTUAL_META, RANKING, VALOR_FIXO_VENDAS, META_SEMANAL, SUPER_META_SEMANAL

-- Create index on tipo_condicao for performance
CREATE INDEX IF NOT EXISTS idx_bonuses_tipo_condicao 
ON sistemaretiradas.bonuses(tipo_condicao) 
WHERE ativo = true;

-- Create composite index for faster queries on active weekly bonuses
CREATE INDEX IF NOT EXISTS idx_bonuses_weekly_active 
ON sistemaretiradas.bonuses(store_id, tipo_condicao, ativo) 
WHERE tipo_condicao IN ('META_SEMANAL', 'SUPER_META_SEMANAL') AND ativo = true;

-- Verify the structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'bonuses'
ORDER BY ordinal_position;

