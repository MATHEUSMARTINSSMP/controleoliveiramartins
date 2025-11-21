-- Migration: Add complete RLS policies for 'goals' table
-- This migration drops ALL existing policies and recreates them from scratch
-- Ensures LOJA, ADMIN, and COLABORADORA profiles can view/manage goals correctly

-- Enable RLS on the 'goals' table if not already enabled
ALTER TABLE sistemaretiradas.goals ENABLE ROW LEVEL SECURITY;

-- Step 1: Drop ALL existing policies on goals table
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on goals table
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'goals'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.goals', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
    
    -- Also try to drop policies that might not be in pg_policies yet
    DROP POLICY IF EXISTS "LOJA can view goals from their store" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "LOJA can view monthly goals from their store" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "LOJA can view individual goals from their store" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "LOJA can view weekly goals from their store" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "Users can view their own goals" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "ADMIN can manage all goals" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "COLABORADORA can view their own goals" ON sistemaretiradas.goals;
    DROP POLICY IF EXISTS "Users can view store goals if they belong to that store" ON sistemaretiradas.goals;
    
    RAISE NOTICE 'All existing policies dropped';
END $$;

-- Step 2: Create Policy 1 - ADMIN can manage all goals (highest priority)
CREATE POLICY "ADMIN can manage all goals"
ON sistemaretiradas.goals
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'ADMIN' 
        AND active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'ADMIN' 
        AND active = true
    )
);
COMMENT ON POLICY "ADMIN can manage all goals" ON sistemaretiradas.goals IS
'Allows ADMIN profiles to manage all goals in the system (SELECT, INSERT, UPDATE, DELETE).';

-- Step 3: Create Policy 2 - LOJA can view monthly goals (MENSAL) for their store
CREATE POLICY "LOJA can view monthly goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- User must be LOJA
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'LOJA' 
        AND active = true
    )
    AND
    -- Goal must be MENSAL type with null colaboradora_id (store goal)
    tipo = 'MENSAL'
    AND colaboradora_id IS NULL
    AND
    -- Goal must belong to LOJA's store
    (
        store_id = (
            SELECT store_id 
            FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() 
            AND role = 'LOJA' 
            AND active = true
        )
        OR
        (
            (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'LOJA' AND active = true) IS NULL
            AND
            store_id IN (
                SELECT s.id 
                FROM sistemaretiradas.stores s
                INNER JOIN sistemaretiradas.profiles p ON (
                    LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                    OR s.name = p.store_default
                )
                WHERE p.id = auth.uid() 
                AND p.role = 'LOJA' 
                AND p.active = true
                AND s.active = true
            )
        )
    )
);
COMMENT ON POLICY "LOJA can view monthly goals" ON sistemaretiradas.goals IS
'Allows LOJA profiles to view monthly goals (MENSAL) for their own store (colaboradora_id IS NULL).';

-- Step 4: Create Policy 3 - LOJA can view individual goals (INDIVIDUAL) for their store's collaborators
CREATE POLICY "LOJA can view individual goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- User must be LOJA
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'LOJA' 
        AND active = true
    )
    AND
    -- Goal must be INDIVIDUAL type with non-null colaboradora_id
    tipo = 'INDIVIDUAL'
    AND colaboradora_id IS NOT NULL
    AND
    -- Goal must belong to LOJA's store
    (
        store_id = (
            SELECT store_id 
            FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() 
            AND role = 'LOJA' 
            AND active = true
        )
        OR
        (
            (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'LOJA' AND active = true) IS NULL
            AND
            store_id IN (
                SELECT s.id 
                FROM sistemaretiradas.stores s
                INNER JOIN sistemaretiradas.profiles p ON (
                    LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                    OR s.name = p.store_default
                )
                WHERE p.id = auth.uid() 
                AND p.role = 'LOJA' 
                AND p.active = true
                AND s.active = true
            )
        )
    )
    AND
    -- Collaborator must belong to LOJA's store
    colaboradora_id IN (
        SELECT c.id 
        FROM sistemaretiradas.profiles c
        WHERE c.role = 'COLABORADORA' 
        AND c.active = true
        AND (
            -- Match by store_id
            c.store_id = (
                SELECT p.store_id 
                FROM sistemaretiradas.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role = 'LOJA' 
                AND p.active = true
            )
            OR
            -- Match by store_default if store_id is null
            (
                (SELECT p.store_id FROM sistemaretiradas.profiles p WHERE p.id = auth.uid() AND p.role = 'LOJA' AND p.active = true) IS NULL
                AND
                c.store_id IN (
                    SELECT s.id 
                    FROM sistemaretiradas.stores s
                    INNER JOIN sistemaretiradas.profiles p ON (
                        LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                        OR s.name = p.store_default
                    )
                    WHERE p.id = auth.uid() 
                    AND p.role = 'LOJA' 
                    AND p.active = true
                    AND s.active = true
                )
            )
            OR
            -- Match by store_default name
            (
                c.store_default IS NOT NULL
                AND EXISTS (
                    SELECT 1 
                    FROM sistemaretiradas.profiles p
                    WHERE p.id = auth.uid() 
                    AND p.role = 'LOJA' 
                    AND p.active = true
                    AND (
                        LOWER(TRIM(c.store_default)) = LOWER(TRIM(p.store_default))
                        OR
                        (
                            SELECT COUNT(*) 
                            FROM sistemaretiradas.stores s
                            WHERE s.id = c.store_id
                            AND (
                                LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                                OR s.name = p.store_default
                            )
                        ) > 0
                    )
                )
            )
        )
    )
);
COMMENT ON POLICY "LOJA can view individual goals" ON sistemaretiradas.goals IS
'Allows LOJA profiles to view individual goals (INDIVIDUAL) for collaborators that belong to their store.';

-- Step 5: Create Policy 4 - LOJA can view weekly goals (SEMANAL) for their store's collaborators
CREATE POLICY "LOJA can view weekly goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- User must be LOJA
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'LOJA' 
        AND active = true
    )
    AND
    -- Goal must be SEMANAL type
    tipo = 'SEMANAL'
    AND semana_referencia IS NOT NULL
    AND colaboradora_id IS NOT NULL
    AND
    -- Goal must belong to LOJA's store
    (
        store_id = (
            SELECT store_id 
            FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() 
            AND role = 'LOJA' 
            AND active = true
        )
        OR
        (
            (SELECT store_id FROM sistemaretiradas.profiles WHERE id = auth.uid() AND role = 'LOJA' AND active = true) IS NULL
            AND
            store_id IN (
                SELECT s.id 
                FROM sistemaretiradas.stores s
                INNER JOIN sistemaretiradas.profiles p ON (
                    LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                    OR s.name = p.store_default
                )
                WHERE p.id = auth.uid() 
                AND p.role = 'LOJA' 
                AND p.active = true
                AND s.active = true
            )
        )
    )
    AND
    -- Collaborator must belong to LOJA's store
    colaboradora_id IN (
        SELECT c.id 
        FROM sistemaretiradas.profiles c
        WHERE c.role = 'COLABORADORA' 
        AND c.active = true
        AND (
            c.store_id = (
                SELECT p.store_id 
                FROM sistemaretiradas.profiles p 
                WHERE p.id = auth.uid() 
                AND p.role = 'LOJA' 
                AND p.active = true
            )
            OR
            (
                (SELECT p.store_id FROM sistemaretiradas.profiles p WHERE p.id = auth.uid() AND p.role = 'LOJA' AND p.active = true) IS NULL
                AND
                c.store_id IN (
                    SELECT s.id 
                    FROM sistemaretiradas.stores s
                    INNER JOIN sistemaretiradas.profiles p ON (
                        LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                        OR s.name = p.store_default
                    )
                    WHERE p.id = auth.uid() 
                    AND p.role = 'LOJA' 
                    AND p.active = true
                    AND s.active = true
                )
            )
            OR
            (
                c.store_default IS NOT NULL
                AND EXISTS (
                    SELECT 1 
                    FROM sistemaretiradas.profiles p
                    WHERE p.id = auth.uid() 
                    AND p.role = 'LOJA' 
                    AND p.active = true
                    AND (
                        LOWER(TRIM(c.store_default)) = LOWER(TRIM(p.store_default))
                        OR
                        (
                            SELECT COUNT(*) 
                            FROM sistemaretiradas.stores s
                            WHERE s.id = c.store_id
                            AND (
                                LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                                OR s.name = p.store_default
                            )
                        ) > 0
                    )
                )
            )
        )
    )
);
COMMENT ON POLICY "LOJA can view weekly goals" ON sistemaretiradas.goals IS
'Allows LOJA profiles to view weekly goals (SEMANAL) for collaborators that belong to their store.';

-- Step 6: Create Policy 5 - COLABORADORA can view their own individual and weekly goals
CREATE POLICY "COLABORADORA can view their own goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- User must be COLABORADORA
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'COLABORADORA' 
        AND active = true
    )
    AND
    -- Goal must belong to the collaborator
    colaboradora_id = auth.uid()
    AND
    -- Allow INDIVIDUAL and SEMANAL types
    tipo IN ('INDIVIDUAL', 'SEMANAL')
);
COMMENT ON POLICY "COLABORADORA can view their own goals" ON sistemaretiradas.goals IS
'Allows COLABORADORA profiles to view their own individual (INDIVIDUAL) and weekly (SEMANAL) goals.';

-- Step 7: Create Policy 6 - COLABORADORA can view their store's monthly goal
CREATE POLICY "COLABORADORA can view store monthly goal"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- User must be COLABORADORA
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'COLABORADORA' 
        AND active = true
    )
    AND
    -- Goal must be MENSAL type with null colaboradora_id (store goal)
    tipo = 'MENSAL'
    AND colaboradora_id IS NULL
    AND
    -- Goal must be for the collaborator's store
    store_id IN (
        SELECT COALESCE(c.store_id, s.id)
        FROM sistemaretiradas.profiles c
        LEFT JOIN sistemaretiradas.stores s ON (
            LOWER(TRIM(s.name)) = LOWER(TRIM(c.store_default))
            OR s.name = c.store_default
        )
        WHERE c.id = auth.uid() 
        AND c.role = 'COLABORADORA' 
        AND c.active = true
    )
);
COMMENT ON POLICY "COLABORADORA can view store monthly goal" ON sistemaretiradas.goals IS
'Allows COLABORADORA profiles to view their store monthly goal (MENSAL with colaboradora_id IS NULL).';

-- Step 8: Verify policies were created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'sistemaretiradas' 
    AND tablename = 'goals';
    
    RAISE NOTICE 'Total policies created: %', policy_count;
    
    IF policy_count < 6 THEN
        RAISE WARNING 'Expected at least 6 policies, but found only %', policy_count;
    ELSE
        RAISE NOTICE 'All policies created successfully!';
    END IF;
END $$;
