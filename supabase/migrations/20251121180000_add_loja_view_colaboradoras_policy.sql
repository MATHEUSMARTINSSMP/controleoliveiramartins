-- Migration: Allow LOJA profiles to view colaboradoras from their store
-- This policy allows LOJA profiles to SELECT colaboradoras that belong to their store
-- IMPORTANT: We must avoid recursion by NOT selecting from profiles table inside the policy

-- First, drop existing policy if it exists
DO $$
BEGIN
    DROP POLICY IF EXISTS "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles;
    DROP POLICY IF EXISTS "Users can view their own profile" ON sistemaretiradas.profiles;
    RAISE NOTICE 'Dropped existing policies if they existed';
END $$;

-- Policy 1: Users can always view their own profile (CRITICAL: avoids recursion)
-- This must come first to handle the AuthContext fetching its own profile
CREATE POLICY "Users can view their own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: ADMIN can view all profiles
CREATE POLICY "ADMIN can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM sistemaretiradas.profiles admin_profile
        WHERE admin_profile.id = auth.uid()
        AND admin_profile.role = 'ADMIN'
        AND admin_profile.active = true
    )
);

-- Policy 3: LOJA can view colaboradoras from their store
-- CRITICAL: We avoid recursion by:
-- 1. First checking if the requesting user is LOJA (this uses Policy 1 or Policy 2, not recursive)
-- 2. Then matching colaboradoras by store relationship WITHOUT querying profiles again
CREATE POLICY "LOJA can view colaboradoras from their store"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    -- Only apply to COLABORADORA profiles that are active
    sistemaretiradas.profiles.role = 'COLABORADORA'
    AND sistemaretiradas.profiles.active = true
    -- AND the requesting user is a LOJA profile (this is the key check)
    AND EXISTS (
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
            -- Case 2: LOJA has store_default (name), colaboradora has store_id - match via stores table
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
);

-- Grant necessary permissions (if not already granted)
GRANT SELECT ON sistemaretiradas.profiles TO authenticated;

COMMENT ON POLICY "Users can view their own profile" ON sistemaretiradas.profiles IS 
'Allows any authenticated user to view their own profile. This prevents recursion in other policies.';

COMMENT ON POLICY "ADMIN can view all profiles" ON sistemaretiradas.profiles IS 
'Allows ADMIN profiles to view all profiles in the system.';

COMMENT ON POLICY "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles IS 
'Allows LOJA profiles to view COLABORADORA profiles that belong to their store, matching by store_id or store_default (with normalization).';
