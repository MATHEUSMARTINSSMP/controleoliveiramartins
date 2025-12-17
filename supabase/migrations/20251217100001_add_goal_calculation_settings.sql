-- Migration: Add goal calculation settings to stores table
-- Date: 2025-12-17
-- Description: Adds configuration options for dynamic goal calculations

-- Add columns for goal calculation settings
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS meta_compensar_deficit BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS meta_bonus_frente BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN sistemaretiradas.stores.meta_compensar_deficit IS 
'Quando ativado, distribui o deficit acumulado pelos dias restantes do mes para colaboradoras que estao atras da meta';

COMMENT ON COLUMN sistemaretiradas.stores.meta_bonus_frente IS 
'Quando ativado, aumenta a meta diaria proporcionalmente para colaboradoras que estao a frente da meta mensal';

-- RLS policies already exist on stores table - no additional grants needed
