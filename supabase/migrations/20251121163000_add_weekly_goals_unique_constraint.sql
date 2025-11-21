-- Migration: Add unique constraint for weekly goals (SEMANAL type)
-- This ensures no duplicate weekly goals per store, week, and collaborator

-- First, check if constraint already exists and drop it if it does
DO $$
BEGIN
    -- Drop existing constraint if it exists (in case of re-migration)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'goals_weekly_unique' 
        AND conrelid = 'sistemaretiradas.goals'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.goals 
        DROP CONSTRAINT goals_weekly_unique;
    END IF;
    
    -- Drop existing index if it exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_goals_weekly_unique' 
        AND schemaname = 'sistemaretiradas'
    ) THEN
        DROP INDEX IF EXISTS sistemaretiradas.idx_goals_weekly_unique;
    END IF;
END $$;

-- Create unique partial index for weekly goals
-- This index only applies when tipo = 'SEMANAL'
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_weekly_unique 
ON sistemaretiradas.goals (store_id, semana_referencia, tipo, colaboradora_id)
WHERE tipo = 'SEMANAL' AND semana_referencia IS NOT NULL AND colaboradora_id IS NOT NULL;

-- Also ensure we have an index for monthly goals (if not exists)
-- This is useful for the existing monthly goals functionality
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_monthly_unique 
ON sistemaretiradas.goals (store_id, mes_referencia, tipo, colaboradora_id)
WHERE tipo IN ('MENSAL', 'INDIVIDUAL') AND mes_referencia IS NOT NULL;

-- Add comment explaining the constraints
COMMENT ON INDEX sistemaretiradas.idx_goals_weekly_unique IS 
'Unique constraint for weekly goals: one goal per store, week, type, and collaborator';

COMMENT ON INDEX sistemaretiradas.idx_goals_monthly_unique IS 
'Unique constraint for monthly goals: one goal per store, month, type, and collaborator';

