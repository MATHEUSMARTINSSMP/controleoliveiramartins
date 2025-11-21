-- Migration: Add RLS policies for 'goals' table to allow LOJA profiles to view goals for their store
-- This migration ensures that LOJA profiles can view monthly and individual goals for their associated store.

-- Enable RLS on the 'goals' table if not already enabled
ALTER TABLE sistemaretiradas.goals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "LOJA can view goals from their store" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view monthly goals from their store" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view individual goals from their store" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view weekly goals from their store" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "Users can view their own goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can manage all goals" ON sistemaretiradas.goals;

-- Policy 1: Allow LOJA profiles to SELECT goals for their store (MENSAL and INDIVIDUAL types)
-- This policy allows LOJA to view:
-- - MENSAL goals (where colaboradora_id IS NULL) - store monthly goal
-- - INDIVIDUAL goals (where colaboradora_id IS NOT NULL) - individual collaborator goals for their store
CREATE POLICY "LOJA can view goals from their store"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- Check if user is a LOJA profile
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'LOJA' 
        AND active = true
    )
    AND
    -- Check if the goal belongs to the LOJA's store
    (
        -- Match by store_id directly
        store_id = (
            SELECT store_id 
            FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() 
            AND role = 'LOJA' 
            AND active = true
        )
        OR
        -- Fallback: match by store_default name if store_id is null in profile
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
    -- Allow MENSAL (colaboradora_id IS NULL) and INDIVIDUAL (colaboradora_id IS NOT NULL) types
    tipo IN ('MENSAL', 'INDIVIDUAL')
    AND
    -- For INDIVIDUAL goals, ensure the collaborator belongs to the LOJA's store
    (
        tipo = 'MENSAL' 
        OR 
        (
            tipo = 'INDIVIDUAL' 
            AND colaboradora_id IS NOT NULL
            AND colaboradora_id IN (
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
                )
            )
        )
    )
);
COMMENT ON POLICY "LOJA can view goals from their store" ON sistemaretiradas.goals IS
'Allows LOJA profiles to view monthly (colaboradora_id IS NULL) and individual (colaboradora_id IS NOT NULL) goals for their own store, ensuring individual goals only for collaborators that belong to the LOJA store.';

-- Policy 2: Allow ADMIN to manage all goals
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
'Allows ADMIN profiles to manage all goals in the system.';

-- Policy 3: Allow COLABORADORA to view their own individual goals
CREATE POLICY "COLABORADORA can view their own goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- Check if user is a COLABORADORA profile
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'COLABORADORA' 
        AND active = true
    )
    AND
    -- Check if the goal belongs to the collaborator
    colaboradora_id = auth.uid()
    AND
    tipo IN ('INDIVIDUAL', 'SEMANAL')
);
COMMENT ON POLICY "COLABORADORA can view their own goals" ON sistemaretiradas.goals IS
'Allows COLABORADORA profiles to view their own individual and weekly goals.';

-- Policy 4: Allow authenticated users to view store goals if they belong to that store (for COLABORADORA to see store monthly goal)
CREATE POLICY "Users can view store goals if they belong to that store"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- Must be MENSAL type with null colaboradora_id (store goal)
    tipo = 'MENSAL'
    AND colaboradora_id IS NULL
    AND
    -- User must belong to that store
    store_id IN (
        SELECT COALESCE(p.store_id, s.id)
        FROM sistemaretiradas.profiles p
        LEFT JOIN sistemaretiradas.stores s ON (
            LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
            OR s.name = p.store_default
        )
        WHERE p.id = auth.uid() 
        AND p.active = true
        AND (p.role = 'COLABORADORA' OR p.role = 'LOJA')
    )
);
COMMENT ON POLICY "Users can view store goals if they belong to that store" ON sistemaretiradas.goals IS
'Allows authenticated users (COLABORADORA and LOJA) to view store monthly goals if they belong to that store.';

-- Policy 5: Allow LOJA profiles to SELECT weekly goals for their store's collaborators
CREATE POLICY "LOJA can view weekly goals from their store"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    -- Check if user is a LOJA profile
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() 
        AND role = 'LOJA' 
        AND active = true
    )
    AND
    -- Must be SEMANAL type
    tipo = 'SEMANAL'
    AND
    -- semana_referencia must not be null (required for weekly goals)
    semana_referencia IS NOT NULL
    AND
    -- colaboradora_id must not be null (weekly goals are per collaborator)
    colaboradora_id IS NOT NULL
    AND
    -- Check if the goal belongs to the LOJA's store and collaborators
    (
        -- Match by store_id directly
        store_id = (
            SELECT store_id 
            FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() 
            AND role = 'LOJA' 
            AND active = true
        )
        OR
        -- Fallback: match by store_default name if store_id is null in profile
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
    -- Ensure the collaborator belongs to the LOJA's store
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
                AND
                EXISTS (
                    SELECT 1 
                    FROM sistemaretiradas.profiles p
                    LEFT JOIN sistemaretiradas.stores s ON (
                        LOWER(TRIM(s.name)) = LOWER(TRIM(p.store_default))
                        OR s.name = p.store_default
                    )
                    WHERE p.id = auth.uid() 
                    AND p.role = 'LOJA' 
                    AND p.active = true
                    AND (
                        LOWER(TRIM(c.store_default)) = LOWER(TRIM(p.store_default))
                        OR
                        (s.id IS NOT NULL AND c.store_id = s.id)
                    )
                )
            )
        )
    )
);
COMMENT ON POLICY "LOJA can view weekly goals from their store" ON sistemaretiradas.goals IS
'Allows LOJA profiles to view weekly goals for collaborators from their own store.';

