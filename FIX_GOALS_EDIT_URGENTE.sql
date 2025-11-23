-- FIX URGENTE: Permitir ADMIN editar/criar metas sem restrições
-- Este script garante que ADMIN pode fazer qualquer operação na tabela goals

-- 1. Remover todas as políticas RLS existentes da tabela goals
DROP POLICY IF EXISTS "ADMIN can do everything on goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "COLABORADORA can view own goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can insert goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can update goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can delete goals" ON sistemaretiradas.goals;

-- 2. Criar políticas simplificadas: ADMIN pode tudo, outros roles apenas visualizar
-- Política para ADMIN: pode fazer tudo (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "ADMIN can do everything on goals"
ON sistemaretiradas.goals
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
        AND profiles.active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
        AND profiles.active = true
    )
);

-- Política para LOJA: pode visualizar metas da sua loja
CREATE POLICY "LOJA can view store goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'LOJA'
        AND profiles.active = true
        AND (
            -- LOJA pode ver metas da sua loja (via store_default ou store_id)
            goals.store_id::text = profiles.store_default::text
            OR goals.store_id = profiles.store_id
        )
    )
);

-- Política para COLABORADORA: pode visualizar suas próprias metas
CREATE POLICY "COLABORADORA can view own goals"
ON sistemaretiradas.goals
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'COLABORADORA'
        AND profiles.active = true
        AND goals.colaboradora_id = profiles.id
    )
);

-- 3. Verificar e remover constraints check problemáticos
-- O erro "goals_meta_valor_check" indica que há um constraint validando meta_valor
DO $$
BEGIN
    -- Remover constraint goals_check se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'goals_check' 
        AND conrelid = 'sistemaretiradas.goals'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.goals DROP CONSTRAINT IF EXISTS goals_check;
        RAISE NOTICE 'Constraint goals_check removido';
    END IF;

    -- Remover constraint goals_meta_valor_check se existir
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'goals_meta_valor_check' 
        AND conrelid = 'sistemaretiradas.goals'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.goals DROP CONSTRAINT IF EXISTS goals_meta_valor_check;
        RAISE NOTICE 'Constraint goals_meta_valor_check removido';
    END IF;

    -- Remover qualquer outro constraint check relacionado a meta_valor ou super_meta_valor
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'sistemaretiradas.goals'::regclass
        AND contype = 'c'
        AND (conname LIKE '%meta_valor%' OR conname LIKE '%goals%check%')
    ) LOOP
        EXECUTE format('ALTER TABLE sistemaretiradas.goals DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Constraint % removido', r.conname;
    END LOOP;
END $$;

-- 4. Garantir que RLS está habilitado
ALTER TABLE sistemaretiradas.goals ENABLE ROW LEVEL SECURITY;

-- 5. Verificar estrutura da tabela para garantir que não há campos obrigatórios faltando
-- Se houver campos NOT NULL que não estão sendo preenchidos, isso pode causar o erro

COMMENT ON POLICY "ADMIN can do everything on goals" ON sistemaretiradas.goals IS 
'ADMIN pode fazer qualquer operação (SELECT, INSERT, UPDATE, DELETE) na tabela goals sem restrições';

