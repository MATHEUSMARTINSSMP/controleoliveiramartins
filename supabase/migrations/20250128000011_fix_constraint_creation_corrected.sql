-- ============================================================================
-- MIGRATION: Garantir que constraint unique em cashback_balance existe (CORRIGIDO)
-- Data: 2025-01-28
-- Descrição: Versão corrigida sem blocos DO aninhados
-- ============================================================================

-- ============================================================================
-- 1. REMOVER CONSTRAINTS ANTIGAS/DUPLICADAS
-- ============================================================================

-- Primeiro, verificar se existe alguma constraint unique em cliente_id
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Buscar todas as constraints unique em cliente_id
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.cashback_balance'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 1
          AND conkey[1] = (
              SELECT attnum 
              FROM pg_attribute 
              WHERE attrelid = 'sistemaretiradas.cashback_balance'::regclass 
                AND attname = 'cliente_id'
          )
          AND conname != 'cashback_balance_unique_cliente'
    LOOP
        -- Dropar constraints com nomes diferentes
        EXECUTE format('ALTER TABLE sistemaretiradas.cashback_balance DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Removida constraint antiga: %', constraint_record.conname;
    END LOOP;
END $$;

-- ============================================================================
-- 2. CRIAR CONSTRAINT COM NOME CORRETO
-- ============================================================================

DO $$
BEGIN
    -- Verificar se constraint já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cashback_balance_unique_cliente'
          AND conrelid = 'sistemaretiradas.cashback_balance'::regclass
    ) THEN
        -- Criar constraint
        ALTER TABLE sistemaretiradas.cashback_balance
        ADD CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id);
        
        RAISE NOTICE 'Constraint cashback_balance_unique_cliente criada com sucesso';
    ELSE
        RAISE NOTICE 'Constraint cashback_balance_unique_cliente já existe';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint já existe, tudo bem
        RAISE NOTICE 'Constraint já existia (duplicate_object)';
END $$;

-- ============================================================================
-- 3. ADICIONAR COMENTÁRIO
-- ============================================================================

COMMENT ON CONSTRAINT cashback_balance_unique_cliente ON sistemaretiradas.cashback_balance 
IS 'Garante que cada cliente tem apenas um registro de saldo de cashback';
