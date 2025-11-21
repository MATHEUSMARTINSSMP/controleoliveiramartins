-- Add daily_weights column to goals table to store specific date weights
ALTER TABLE sistemaretiradas.goals 
ADD COLUMN IF NOT EXISTS daily_weights JSONB DEFAULT '{}'::jsonb;

-- Comment explaining the structure
COMMENT ON COLUMN sistemaretiradas.goals.daily_weights IS 'JSON object mapping YYYY-MM-DD strings to numeric weights, e.g., {"2025-12-01": 1.5, "2025-12-02": 1.0}';
