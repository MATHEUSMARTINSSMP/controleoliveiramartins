-- Migration: Recreate all RLS policies for profiles table from scratch
-- This removes ALL existing policies and creates new ones to avoid conflicts

-- Step 1: Remove ALL existing policies on profiles table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.profiles', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 2: Remove all existing SECURITY DEFINER functions if they exist
DROP FUNCTION IF EXISTS sistemaretiradas.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.is_user_loja() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.is_user_admin() CASCADE;

-- Step 3: Create SECURITY DEFINER function to get user role (bypasses RLS)
-- This function can be called inside policies without causing recursion
CREATE OR REPLACE FUNCTION sistemaretiradas.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, pg_temp
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND active = true
    LIMIT 1;
    
    RETURN COALESCE(user_role, '');
END;
$$;

-- Step 4: Create SECURITY DEFINER function to check if user is LOJA
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_loja()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, pg_temp
STABLE
AS $$
BEGIN
    RETURN sistemaretiradas.get_user_role() = 'LOJA';
END;
$$;

-- Step 5: Create SECURITY DEFINER function to check if user is ADMIN
CREATE OR REPLACE FUNCTION sistemaretiradas.is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, pg_temp
STABLE
AS $$
BEGIN
    RETURN sistemaretiradas.get_user_role() = 'ADMIN';
END;
$$;

-- Step 6: Create Policy 1 - Users can view their own profile by ID (CRITICAL for login)
-- This must come FIRST to avoid recursion
CREATE POLICY "Users can view their own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Step 7: Create Policy 2 - Users can view their own profile by email (for AuthContext)
-- This allows AuthContext to fetch profile by email during login
CREATE POLICY "Users can view own profile by email"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = auth.uid() 
        AND email = sistemaretiradas.profiles.email
    )
);

-- Step 8: Create Policy 3 - ADMIN can view all profiles
CREATE POLICY "ADMIN can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_admin());

-- Step 9: Create Policy 4 - LOJA can view colaboradoras from their store
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "LOJA can view colaboradoras from their store"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    -- Only apply to COLABORADORA profiles that are active
    sistemaretiradas.profiles.role = 'COLABORADORA'
    AND sistemaretiradas.profiles.active = true
    -- AND the requesting user is a LOJA profile (using SECURITY DEFINER function)
    AND sistemaretiradas.is_user_loja()
    -- AND match by store relationship (using SECURITY DEFINER to get LOJA profile)
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

-- Step 10: Grant necessary permissions
GRANT SELECT ON sistemaretiradas.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.is_user_loja() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.is_user_admin() TO authenticated;

-- Step 11: Add comments for documentation
COMMENT ON POLICY "Users can view their own profile" ON sistemaretiradas.profiles IS 
'Allows any authenticated user to view their own profile by ID. This prevents recursion in other policies.';

COMMENT ON POLICY "Users can view own profile by email" ON sistemaretiradas.profiles IS 
'Allows any authenticated user to view their own profile by email. Used by AuthContext during login.';

COMMENT ON POLICY "ADMIN can view all profiles" ON sistemaretiradas.profiles IS 
'Allows ADMIN profiles to view all profiles in the system.';

COMMENT ON POLICY "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles IS 
'Allows LOJA profiles to view COLABORADORA profiles that belong to their store, matching by store_id or store_default (with normalization).';

COMMENT ON FUNCTION sistemaretiradas.get_user_role() IS 
'SECURITY DEFINER function to get the role of the current user. Bypasses RLS to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.is_user_loja() IS 
'SECURITY DEFINER function to check if the current user is a LOJA profile. Bypasses RLS to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.is_user_admin() IS 
'SECURITY DEFINER function to check if the current user is an ADMIN profile. Bypasses RLS to avoid recursion.';
