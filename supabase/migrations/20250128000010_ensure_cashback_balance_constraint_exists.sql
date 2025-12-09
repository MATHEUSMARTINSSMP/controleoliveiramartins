-- ============================================================================
-- MIGRATION: Garantir que constraint unique em cashback_balance existe
-- Data: 2025-01-28
-- Descrição: Cria a constraint se não existir, para evitar erro 42704
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR E CRIAR CONSTRAINT SE NÃO EXISTIR
-- ============================================================================

-- Remover constraint antiga se existir com nome diferente
DO $$
BEGIN
    -- Tentar dropar constraint se existir (ignorar erro se não existir)
    ALTER TABLE sistemaretiradas.cashback_balance 
    DROP CONSTRAINT IF EXISTS cashback_balance_unique_cliente;
    
    -- Tentar dropar qualquer constraint unique em cliente_id se existir
    DO $inner$
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.cashback_balance'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 1
          AND conkey[1] = (
              SELECT attnum 
              FROM pg_attribute 
              WHERE attrelid = 'sistemaretiradas.cashback_balance'::regclass 
                AND attname = 'cliente_id'
          );
        
        IF constraint_name IS NOT NULL AND constraint_name != 'cashback_balance_unique_cliente' THEN
            EXECUTE format('ALTER TABLE sistemaretiradas.cashback_balance DROP CONSTRAINT IF EXISTS %I', constraint_name);
        END IF;
    END $inner$;
END $$;

-- Criar constraint com o nome correto (ignorar erro se já existir)
DO $$
BEGIN
    -- Tentar criar constraint, ignorando se já existir
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'cashback_balance_unique_cliente'
          AND conrelid = 'sistemaretiradas.cashback_balance'::regclass
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_balance
        ADD CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint já existe, tudo bem
        NULL;
END $$;

-- ============================================================================
-- 2. VERIFICAR E COMENTAR A CONSTRAINT
-- ============================================================================
COMMENT ON CONSTRAINT cashback_balance_unique_cliente ON sistemaretiradas.cashback_balance IS 'Garante que cada cliente tem apenas um registro de saldo de cashback';



