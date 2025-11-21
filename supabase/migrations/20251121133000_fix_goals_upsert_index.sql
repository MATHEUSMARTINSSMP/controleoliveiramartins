-- Fix unique constraints for upsert compatibility
-- Drop previous partial indexes that cause issues with upsert
DROP INDEX IF EXISTS sistemaretiradas.idx_goals_store_monthly;
DROP INDEX IF EXISTS sistemaretiradas.idx_goals_individual_monthly;

-- Create a single, comprehensive unique index
-- We use NULLS NOT DISTINCT to ensure that (store_id, mes, tipo, NULL) is treated as a unique combination
-- This handles both Store Goals (colaboradora_id is NULL) and Individual Goals (colaboradora_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_upsert_compatible 
ON sistemaretiradas.goals (store_id, mes_referencia, tipo, colaboradora_id) 
NULLS NOT DISTINCT;
