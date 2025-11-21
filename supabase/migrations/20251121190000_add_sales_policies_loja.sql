-- Migration: Allow LOJA profiles to insert, update, and delete sales for their store
-- This policy allows LOJA profiles to manage sales for their store

-- Step 1: Remove existing policies if they exist
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'sales'
        AND policyname LIKE '%LOJA%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.sales', policy_record.policyname);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 2: Create SECURITY DEFINER function to check if user is LOJA (reuse existing)
-- Note: This function should already exist from the profiles migration, but we ensure it exists

-- Step 3: Create SECURITY DEFINER function to get LOJA store_id
CREATE OR REPLACE FUNCTION sistemaretiradas.get_loja_store_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, pg_temp
STABLE
AS $$
DECLARE
    loja_store_id UUID;
    loja_store_default TEXT;
BEGIN
    -- First try to get store_id directly
    SELECT store_id, store_default INTO loja_store_id, loja_store_default
    FROM sistemaretiradas.profiles
    WHERE id = auth.uid()
    AND role = 'LOJA'
    AND active = true
    LIMIT 1;
    
    -- If store_id is null, try to get it from stores table using store_default
    IF loja_store_id IS NULL AND loja_store_default IS NOT NULL THEN
        SELECT id INTO loja_store_id
        FROM sistemaretiradas.stores
        WHERE (
            name = loja_store_default
            OR LOWER(TRIM(name)) = LOWER(TRIM(loja_store_default))
        )
        AND active = true
        LIMIT 1;
    END IF;
    
    RETURN loja_store_id;
END;
$$;

-- Step 4: Policy for LOJA to SELECT sales from their store
CREATE POLICY "LOJA can view sales from their store"
ON sistemaretiradas.sales
FOR SELECT
TO authenticated
USING (
    sistemaretiradas.is_user_loja()
    AND (
        store_id = sistemaretiradas.get_loja_store_id()
        OR store_id IS NULL
    )
);

-- Step 5: Policy for LOJA to INSERT sales for their store
CREATE POLICY "LOJA can insert sales for their store"
ON sistemaretiradas.sales
FOR INSERT
TO authenticated
WITH CHECK (
    sistemaretiradas.is_user_loja()
    AND store_id = sistemaretiradas.get_loja_store_id()
);

-- Step 6: Policy for LOJA to UPDATE sales from their store
CREATE POLICY "LOJA can update sales from their store"
ON sistemaretiradas.sales
FOR UPDATE
TO authenticated
USING (
    sistemaretiradas.is_user_loja()
    AND store_id = sistemaretiradas.get_loja_store_id()
)
WITH CHECK (
    sistemaretiradas.is_user_loja()
    AND store_id = sistemaretiradas.get_loja_store_id()
);

-- Step 7: Policy for LOJA to DELETE sales from their store
CREATE POLICY "LOJA can delete sales from their store"
ON sistemaretiradas.sales
FOR DELETE
TO authenticated
USING (
    sistemaretiradas.is_user_loja()
    AND store_id = sistemaretiradas.get_loja_store_id()
);

-- Step 8: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sistemaretiradas.sales TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_loja_store_id() TO authenticated;

-- Step 9: Add comments for documentation
COMMENT ON POLICY "LOJA can view sales from their store" ON sistemaretiradas.sales IS 
'Allows LOJA profiles to view sales from their store. Uses SECURITY DEFINER functions to avoid recursion.';

COMMENT ON POLICY "LOJA can insert sales for their store" ON sistemaretiradas.sales IS 
'Allows LOJA profiles to insert sales for their store. Uses SECURITY DEFINER functions to verify store ownership.';

COMMENT ON POLICY "LOJA can update sales from their store" ON sistemaretiradas.sales IS 
'Allows LOJA profiles to update sales from their store. Uses SECURITY DEFINER functions to verify store ownership.';

COMMENT ON POLICY "LOJA can delete sales from their store" ON sistemaretiradas.sales IS 
'Allows LOJA profiles to delete sales from their store. Uses SECURITY DEFINER functions to verify store ownership.';

COMMENT ON FUNCTION sistemaretiradas.get_loja_store_id() IS 
'SECURITY DEFINER function to get the store_id for the current LOJA user. Bypasses RLS to avoid recursion. Returns UUID.';

