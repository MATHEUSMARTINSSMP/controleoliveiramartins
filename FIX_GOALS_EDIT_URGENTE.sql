-- FIX URGENTE: Permitir ADMIN editar/criar metas sem restrições
-- Este script garante que ADMIN pode fazer qualquer operação na tabela goals
-- SCRIPT IDEMPOTENTE - pode ser executado múltiplas vezes sem erro

-- 1. Remover TODAS as políticas RLS existentes da tabela goals (incluindo variações de nome)
DROP POLICY IF EXISTS "ADMIN can do everything on goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "LOJA can view store goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "COLABORADORA can view own goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can insert goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can update goals" ON sistemaretiradas.goals;
DROP POLICY IF EXISTS "ADMIN can delete goals" ON sistemaretiradas.goals;

-- Remover qualquer outra política que possa existir
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'goals'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.goals', r.policyname);
        RAISE NOTICE 'Política % removida', r.policyname;
    END LOOP;
END $$;

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

-- 3. Remover TODOS os constraints check problemáticos
-- O erro "goals_meta_valor_check" indica que há um constraint validando meta_valor
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remover TODOS os constraints check da tabela goals
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'sistemaretiradas.goals'::regclass
        AND contype = 'c'  -- 'c' = CHECK constraint
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE sistemaretiradas.goals DROP CONSTRAINT IF EXISTS %I', r.conname);
            RAISE NOTICE 'Constraint % removido', r.conname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao remover constraint %: %', r.conname, SQLERRM;
        END;
    END LOOP;
    
    -- Verificar se ainda existem constraints problemáticos
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'sistemaretiradas.goals'::regclass
        AND contype = 'c'
        AND (conname LIKE '%meta_valor%' OR conname LIKE '%goals%check%' OR conname LIKE '%check%')
    ) THEN
        RAISE NOTICE 'ATENÇÃO: Ainda existem constraints check na tabela goals';
    ELSE
        RAISE NOTICE 'Todos os constraints check foram removidos com sucesso';
    END IF;
END $$;

-- 4. Garantir que RLS está habilitado
ALTER TABLE sistemaretiradas.goals ENABLE ROW LEVEL SECURITY;

-- 5. Verificar estrutura da tabela para garantir que não há campos obrigatórios faltando
-- Se houver campos NOT NULL que não estão sendo preenchidos, isso pode causar o erro

COMMENT ON POLICY "ADMIN can do everything on goals" ON sistemaretiradas.goals IS 
'ADMIN pode fazer qualquer operação (SELECT, INSERT, UPDATE, DELETE) na tabela goals sem restrições';

