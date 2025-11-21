-- Migration: Add support for weekly bonus types (META_SEMANAL and SUPER_META_SEMANAL)
-- This migration ensures the bonuses table can support weekly bonus conditions

-- Check if tipo_condicao column exists, if not, we might need to add it
-- But based on the user's example, it already exists, so we just need to ensure
-- the table structure supports weekly bonuses

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
        ADD COLUMN store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_bonuses_store_id 
        ON sistemaretiradas.bonuses(store_id);
        
        RAISE NOTICE 'Added store_id column to bonuses table';
    ELSE
        RAISE NOTICE 'store_id column already exists in bonuses table';
    END IF;
END $$;

-- Add tipo_condicao column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'bonuses' 
        AND column_name = 'tipo_condicao'
    ) THEN
        ALTER TABLE sistemaretiradas.bonuses
        ADD COLUMN tipo_condicao VARCHAR(50);
        
        -- Update existing records to use tipo_condicao based on tipo
        UPDATE sistemaretiradas.bonuses
        SET tipo_condicao = CASE
            WHEN tipo = 'PERCENTUAL' THEN 'PERCENTUAL_META'
            WHEN tipo = 'RANKING' THEN 'RANKING'
            WHEN tipo = 'VALOR_FIXO' THEN 'VALOR_FIXO_VENDAS'
            ELSE 'PERCENTUAL_META'
        END
        WHERE tipo_condicao IS NULL;
        
        RAISE NOTICE 'Added tipo_condicao column to bonuses table';
    ELSE
        RAISE NOTICE 'tipo_condicao column already exists in bonuses table';
    END IF;
END $$;

-- Verify the structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'bonuses'
ORDER BY ordinal_position;

