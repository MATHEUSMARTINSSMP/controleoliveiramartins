-- Migration: Create bonus_collaborators table
-- Description: Link bonuses to specific collaborators to allow granular control
-- Date: 2025-11-24

SET search_path TO sistemaretiradas, public;

-- Create table
CREATE TABLE IF NOT EXISTS bonus_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bonus_id UUID NOT NULL REFERENCES bonuses(id) ON DELETE CASCADE,
    colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(bonus_id, colaboradora_id)
);

-- Enable RLS
ALTER TABLE bonus_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies

-- Admin can do everything
CREATE POLICY "admin_all_bonus_collaborators" 
ON bonus_collaborators 
FOR ALL 
USING (get_user_role() = 'ADMIN');

-- Loja can view and manage for their store's collaborators
CREATE POLICY "loja_manage_bonus_collaborators" 
ON bonus_collaborators 
FOR ALL 
USING (
    get_user_role() = 'LOJA' 
    AND EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = bonus_collaborators.colaboradora_id 
        AND p.store_id::text = get_user_store_id_text()
    )
);

-- Colaboradora can view their own
CREATE POLICY "colab_view_own_bonus_collaborators" 
ON bonus_collaborators 
FOR SELECT 
USING (colaboradora_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bonus_collaborators_bonus_id ON bonus_collaborators(bonus_id);
CREATE INDEX IF NOT EXISTS idx_bonus_collaborators_colaboradora_id ON bonus_collaborators(colaboradora_id);
