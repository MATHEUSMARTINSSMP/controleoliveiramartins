-- Add unique constraints to goals table to support upsert operations

-- 1. Unique constraint for Store Goals (MENSAL)
-- Ensures only one monthly goal per store per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_store_monthly 
ON sistemaretiradas.goals (store_id, mes_referencia, tipo) 
WHERE tipo = 'MENSAL';

-- 2. Unique constraint for Individual Goals (INDIVIDUAL)
-- Ensures only one individual goal per collaborator per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_individual_monthly 
ON sistemaretiradas.goals (store_id, mes_referencia, colaboradora_id, tipo) 
WHERE tipo = 'INDIVIDUAL';
