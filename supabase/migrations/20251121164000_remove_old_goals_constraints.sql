-- Migration: Remove old conflicting constraints and ensure clean state
-- This removes the old idx_goals_upsert_compatible constraint that's causing conflicts

DO $$
BEGIN
    -- Drop old constraint idx_goals_upsert_compatible if it exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_goals_upsert_compatible' 
        AND schemaname = 'sistemaretiradas'
    ) THEN
        DROP INDEX IF EXISTS sistemaretiradas.idx_goals_upsert_compatible;
        RAISE NOTICE 'Dropped old index idx_goals_upsert_compatible';
    END IF;
    
    -- Drop any constraint with similar name
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'idx_goals_upsert_compatible' 
        AND conrelid = 'sistemaretiradas.goals'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.goals 
        DROP CONSTRAINT IF EXISTS idx_goals_upsert_compatible;
        RAISE NOTICE 'Dropped old constraint idx_goals_upsert_compatible';
    END IF;
    
    -- Ensure our new unique indexes exist and are correct
    -- Weekly goals index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_goals_weekly_unique' 
        AND schemaname = 'sistemaretiradas'
    ) THEN
        CREATE UNIQUE INDEX idx_goals_weekly_unique 
        ON sistemaretiradas.goals (store_id, semana_referencia, tipo, colaboradora_id)
        WHERE tipo = 'SEMANAL' AND semana_referencia IS NOT NULL AND colaboradora_id IS NOT NULL;
        RAISE NOTICE 'Created idx_goals_weekly_unique';
    END IF;
    
    -- Monthly goals index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_goals_monthly_unique' 
        AND schemaname = 'sistemaretiradas'
    ) THEN
        CREATE UNIQUE INDEX idx_goals_monthly_unique 
        ON sistemaretiradas.goals (store_id, mes_referencia, tipo, colaboradora_id)
        WHERE tipo IN ('MENSAL', 'INDIVIDUAL') AND mes_referencia IS NOT NULL;
        RAISE NOTICE 'Created idx_goals_monthly_unique';
    END IF;
END $$;

-- Verify indexes exist
SELECT 
    i.relname as index_name, 
    array_to_string(array_agg(a.attname ORDER BY a.attnum), ', ') as column_names,
    ix.indisunique as is_unique,
    pg_get_indexdef(ix.indexrelid) as index_definition
FROM 
    pg_class t, 
    pg_class i, 
    pg_index ix, 
    pg_attribute a 
WHERE 
    t.oid = ix.indrelid 
    AND i.oid = ix.indexrelid 
    AND a.attrelid = t.oid 
    AND a.attnum = ANY(ix.indkey) 
    AND t.relkind = 'r' 
    AND t.relname = 'goals' 
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
    AND i.relname IN ('idx_goals_weekly_unique', 'idx_goals_monthly_unique', 'idx_goals_upsert_compatible')
GROUP BY 
    i.relname, 
    ix.indisunique,
    ix.indexrelid
ORDER BY i.relname;

