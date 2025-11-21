-- Migration: Recreate all RLS policies for profiles table from scratch
-- This removes ALL existing policies and creates new ones to avoid conflicts
-- IMPORTANT: No SELECT from profiles table inside policies to avoid recursion

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
DROP FUNCTION IF EXISTS sistemaretiradas.get_loja_store_info() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.get_user_email() CASCADE;

-- Step 3: Create SECURITY DEFINER function to get user email (bypasses RLS)
-- This is CRITICAL for Policy 2 to avoid "permission denied for table users"
CREATE OR REPLACE FUNCTION sistemaretiradas.get_user_email()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp
STABLE
AS $$
DECLARE
    user_email TEXT;
BEGIN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN COALESCE(user_email, '');
END;
$$;

-- Step 4: Create SECURITY DEFINER function to get user role (bypasses RLS)
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

-- Step 5: Create SECURITY DEFINER function to check if user is LOJA
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

-- Step 6: Create SECURITY DEFINER function to check if user is ADMIN
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

-- Step 7: Create SECURITY DEFINER function to get LOJA store info (bypasses RLS)
-- Returns JSON with store_id and store_default for the current LOJA user
CREATE OR REPLACE FUNCTION sistemaretiradas.get_loja_store_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, pg_temp
STABLE
AS $$
DECLARE
    store_info JSON;
BEGIN
    SELECT json_build_object(
        'store_id', store_id,
        'store_default', store_default
    ) INTO store_info
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'LOJA'
    AND active = true
    LIMIT 1;
    
    RETURN COALESCE(store_info, '{"store_id": null, "store_default": null}'::json);
END;
$$;

-- Step 8: Create Policy 1 - Users can view their own profile by ID (CRITICAL for login)
-- This must come FIRST and uses only auth.uid(), no table queries
CREATE POLICY "Users can view their own profile"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Step 9: Create Policy 2 - Users can view their own profile by email (for AuthContext)
-- Uses SECURITY DEFINER function to get email, avoiding "permission denied for table users"
CREATE POLICY "Users can view own profile by email"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (
    email = sistemaretiradas.get_user_email()
    OR email ILIKE sistemaretiradas.get_user_email()
);

-- Step 10: Create Policy 3 - ADMIN can view all profiles
-- Uses SECURITY DEFINER function, no direct table queries
CREATE POLICY "ADMIN can view all profiles"
ON sistemaretiradas.profiles
FOR SELECT
TO authenticated
USING (sistemaretiradas.is_user_admin());

-- Step 11: Create Policy 4 - LOJA can view colaboradoras from their store
-- CRITICAL: Uses SECURITY DEFINER function to get store info, NO SELECT from profiles in policy
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
    -- AND match by store relationship using SECURITY DEFINER function (NO SELECT from profiles here)
    AND (
        -- Case 1: Match by store_id if colaboradora has store_id that matches LOJA's store_id
        (sistemaretiradas.profiles.store_id IS NOT NULL
         AND sistemaretiradas.profiles.store_id = (sistemaretiradas.get_loja_store_info()->>'store_id')::uuid)
        OR
        -- Case 2: LOJA has store_default (name), colaboradora has store_id - match via stores table
        ((sistemaretiradas.get_loja_store_info()->>'store_id')::uuid IS NULL
         AND sistemaretiradas.get_loja_store_info()->>'store_default' IS NOT NULL
         AND sistemaretiradas.profiles.store_id IS NOT NULL
         AND EXISTS (
             SELECT 1 
             FROM sistemaretiradas.stores s
             WHERE s.id = sistemaretiradas.profiles.store_id
             AND (
                 s.name = sistemaretiradas.get_loja_store_info()->>'store_default'
                 OR LOWER(TRIM(s.name)) = LOWER(TRIM(sistemaretiradas.get_loja_store_info()->>'store_default'))
             )
         ))
        OR
        -- Case 3: Match by store_default name (both have names, normalize for comparison)
        (sistemaretiradas.get_loja_store_info()->>'store_default' IS NOT NULL
         AND sistemaretiradas.profiles.store_default IS NOT NULL
         AND LOWER(TRIM(sistemaretiradas.get_loja_store_info()->>'store_default')) = LOWER(TRIM(sistemaretiradas.profiles.store_default)))
    )
);

-- Step 12: Grant necessary permissions
GRANT SELECT ON sistemaretiradas.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.is_user_loja() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_loja_store_info() TO authenticated;

-- Step 13: Add comments for documentation
COMMENT ON POLICY "Users can view their own profile" ON sistemaretiradas.profiles IS 
'Allows any authenticated user to view their own profile by ID. This prevents recursion in other policies.';

COMMENT ON POLICY "Users can view own profile by email" ON sistemaretiradas.profiles IS 
'Allows any authenticated user to view their own profile by email. Used by AuthContext during login. Uses SECURITY DEFINER function to avoid permission denied errors.';

COMMENT ON POLICY "ADMIN can view all profiles" ON sistemaretiradas.profiles IS 
'Allows ADMIN profiles to view all profiles in the system. Uses SECURITY DEFINER function to avoid recursion.';

COMMENT ON POLICY "LOJA can view colaboradoras from their store" ON sistemaretiradas.profiles IS 
'Allows LOJA profiles to view COLABORADORA profiles that belong to their store. Uses SECURITY DEFINER functions only, NO SELECT from profiles table inside policy to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.get_user_email() IS 
'SECURITY DEFINER function to get the email of the current user from auth.users. Bypasses RLS to avoid permission denied errors.';

COMMENT ON FUNCTION sistemaretiradas.get_user_role() IS 
'SECURITY DEFINER function to get the role of the current user. Bypasses RLS to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.is_user_loja() IS 
'SECURITY DEFINER function to check if the current user is a LOJA profile. Bypasses RLS to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.is_user_admin() IS 
'SECURITY DEFINER function to check if the current user is an ADMIN profile. Bypasses RLS to avoid recursion.';

COMMENT ON FUNCTION sistemaretiradas.get_loja_store_info() IS 
'SECURITY DEFINER function to get store_id and store_default for the current LOJA user. Bypasses RLS to avoid recursion. Returns JSON.';
