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
-- 3. The colaboradora's store_id or store_default matches the LOJA's store
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
            -- Case 1: Match by store_id if both have store_id (most reliable)
            (loja_profile.store_id IS NOT NULL 
             AND sistemaretiradas.profiles.store_id IS NOT NULL
             AND loja_profile.store_id = sistemaretiradas.profiles.store_id)
            OR
            -- Case 2: LOJA has store_default (name), colaboradora has store_id - need to match via stores table
            (loja_profile.store_id IS NULL 
             AND loja_profile.store_default IS NOT NULL
             AND sistemaretiradas.profiles.store_id IS NOT NULL
             AND EXISTS (
                 SELECT 1 
                 FROM sistemaretiradas.stores s
                 WHERE s.id = sistemaretiradas.profiles.store_id
                 AND (
                     s.name = loja_profile.store_default
                     OR LOWER(TRIM(s.name)) = LOWER(TRIM(loja_profile.store_default))
                 )
             ))
            OR
            -- Case 3: Match by store_default name (both have names, normalize for comparison)
            (loja_profile.store_default IS NOT NULL 
             AND sistemaretiradas.profiles.store_default IS NOT NULL
             AND LOWER(TRIM(loja_profile.store_default)) = LOWER(TRIM(sistemaretiradas.profiles.store_default)))
        )
    )
    -- Only allow viewing COLABORADORA profiles that are active
    AND sistemaretiradas.profiles.role = 'COLABORADORA'
    AND sistemaretiradas.profiles.active = true
);

-- Grant necessary permissions (if not already granted)
GRANT SELECT ON sistemaretiradas.profiles TO authenticated;

COMMENT ON POLICY "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles IS 
'Allows LOJA profiles to view COLABORADORA profiles that belong to their store, matching by store_id or store_default (with normalization)';
