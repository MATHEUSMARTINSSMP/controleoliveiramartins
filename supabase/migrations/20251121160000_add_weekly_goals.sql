-- Migration: Add support for weekly goals (SEMANAL)
-- Weekly goals are the same for all collaborators in the same store
-- Week period: Monday to Sunday

-- 1. Add semana_referencia column to goals table
-- Format: YYYYWW (e.g., 202501 for first week of 2025)
ALTER TABLE sistemaretiradas.goals 
ADD COLUMN IF NOT EXISTS semana_referencia TEXT;

-- 2. Add comment explaining semana_referencia
COMMENT ON COLUMN sistemaretiradas.goals.semana_referencia IS 'Week reference in format YYYYWW (e.g., 202501 = first week of 2025). Monday is the start of the week.';

-- 3. Update unique index to support weekly goals
-- Drop the old index
DROP INDEX IF EXISTS sistemaretiradas.idx_goals_upsert_compatible;

-- Create new comprehensive unique index that handles MENSAL, INDIVIDUAL, and SEMANAL goals
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_upsert_compatible 
ON sistemaretiradas.goals (
    store_id, 
    CASE WHEN tipo = 'SEMANAL' THEN semana_referencia ELSE mes_referencia END,
    tipo, 
    colaboradora_id
) 
NULLS NOT DISTINCT;

-- 4. Add function to get week reference (YYYYWW format, Monday to Sunday)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_week_reference(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_year INTEGER;
    v_week INTEGER;
    v_monday DATE;
BEGIN
    -- Get Monday of the week
    v_monday := DATE_TRUNC('week', p_date)::DATE;
    
    -- Calculate week number (week 1 starts on first Monday of year or Jan 1)
    v_year := EXTRACT(YEAR FROM v_monday);
    
    -- ISO week number
    v_week := EXTRACT(WEEK FROM v_monday);
    
    -- Format: YYYYWW (e.g., 202501, 202502)
    RETURN TO_CHAR(v_year, 'FM9999') || LPAD(v_week::TEXT, 2, '0');
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_week_reference IS 'Returns week reference in YYYYWW format for a given date (Monday to Sunday week)';

-- 5. Add function to calculate weekly goal from monthly goal
-- Weekly goal = (Monthly goal / 4) * adjustment factor
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_weekly_goal_from_monthly(
    p_store_id UUID,
    p_semana_referencia TEXT
)
RETURNS TABLE (
    meta_valor DECIMAL(10,2),
    super_meta_valor DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month TEXT;
    v_monthly_goal RECORD;
    v_weekly_base DECIMAL(10,2);
    v_weekly_super DECIMAL(10,2);
BEGIN
    -- Get the month from week reference (first 6 chars = YYYYMM)
    v_month := SUBSTRING(p_semana_referencia, 1, 6);
    
    -- Get monthly goal for the store
    SELECT meta_valor, super_meta_valor
    INTO v_monthly_goal
    FROM sistemaretiradas.goals
    WHERE store_id = p_store_id
      AND mes_referencia = v_month
      AND tipo = 'MENSAL'
      AND colaboradora_id IS NULL
      AND ativo = true
    LIMIT 1;
    
    IF v_monthly_goal IS NULL THEN
        -- No monthly goal found, return 0
        RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(10,2);
        RETURN;
    END IF;
    
    -- Calculate weekly goal: monthly / 4.33 (average weeks per month)
    -- Or use / 4 for simplicity
    v_weekly_base := (v_monthly_goal.meta_valor / 4.33)::DECIMAL(10,2);
    v_weekly_super := (v_monthly_goal.super_meta_valor / 4.33)::DECIMAL(10,2);
    
    RETURN QUERY SELECT v_weekly_base, v_weekly_super;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.calculate_weekly_goal_from_monthly IS 'Calculates suggested weekly goal from monthly goal (monthly / 4.33)';

-- 6. Add function to get current week reference
CREATE OR REPLACE FUNCTION sistemaretiradas.get_current_week_reference()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN sistemaretiradas.get_week_reference(CURRENT_DATE);
END;
$$;

-- 7. Update RLS policies to include SEMANAL goals
-- The existing policies should work, but let's make sure SEMANAL goals are readable by all store members
CREATE POLICY IF NOT EXISTS "Store members can select weekly goals" 
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    (tipo = 'SEMANAL' AND store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid()
    ))
    OR
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
    OR
    colaboradora_id = auth.uid()
);

-- 8. Add index for weekly goals queries
CREATE INDEX IF NOT EXISTS idx_goals_weekly 
ON sistemaretiradas.goals(store_id, semana_referencia, tipo) 
WHERE tipo = 'SEMANAL';

COMMENT ON INDEX idx_goals_weekly IS 'Optimizes queries for weekly goals by store and week';

