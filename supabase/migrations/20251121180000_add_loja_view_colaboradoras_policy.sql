-- Migration: Allow LOJA profiles to view colaboradoras from their store
-- This policy allows LOJA profiles to SELECT colaboradoras that belong to their store

-- First, let's check if there's an existing policy and drop it if needed
DO $$
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles;
    
    RAISE NOTICE 'Dropped existing policy if it existed';
END $$;

-- Create policy for LOJA profiles to view colaboradoras from their store
-- The policy checks:
-- 1. The user is a LOJA profile
-- 2. The profile being viewed is a COLABORADORA
-- 3. The colaboradora's store_id matches the LOJA's store (via store_default or store_id)
CREATE POLICY "LOJA can view colaboradoras from their store"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    -- Allow if the requesting user is a LOJA profile
    EXISTS (
        SELECT 1 
        FROM sistemaretiradas.profiles loja_profile
        WHERE loja_profile.id = auth.uid()
        AND loja_profile.role = 'LOJA'
        AND loja_profile.active = true
        AND (
            -- Match by store_id if LOJA profile has store_id set
            (loja_profile.store_id IS NOT NULL 
             AND sistemaretiradas.profiles.store_id = loja_profile.store_id)
            OR
            -- Match by store_default if LOJA profile has store_default set
            (loja_profile.store_default IS NOT NULL 
             AND sistemaretiradas.profiles.store_default = loja_profile.store_default
             AND sistemaretiradas.profiles.store_id IS NULL)
            OR
            -- Match by store_default name if both have store_default
            (loja_profile.store_default IS NOT NULL 
             AND sistemaretiradas.profiles.store_default IS NOT NULL
             AND LOWER(TRIM(loja_profile.store_default)) = LOWER(TRIM(sistemaretiradas.profiles.store_default)))
        )
    )
    -- Only allow viewing COLABORADORA profiles
    AND sistemaretiradas.profiles.role = 'COLABORADORA'
    AND sistemaretiradas.profiles.active = true
);

-- Grant necessary permissions
GRANT SELECT ON sistemaretiradas.profiles TO authenticated;

COMMENT ON POLICY "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles IS 
'Allows LOJA profiles to view COLABORADORA profiles that belong to their store, matching by store_id or store_default';

