-- =====================================================
-- REMOVER CONSTRAINT DE ACCOUNT_TYPE E TORNAR PHONE NULLABLE
-- =====================================================
-- Remover constraint whatsapp_accounts_account_type_check
-- pois não estamos mais usando account_type, apenas is_backup1/2/3
-- Tornar phone nullable para permitir criar registro antes de conectar
-- =====================================================

-- 1. Remover constraint de account_type se existir
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_account_type_check'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_account_type_check;
        
        RAISE NOTICE 'Constraint whatsapp_accounts_account_type_check removida com sucesso';
    ELSE
        RAISE NOTICE 'Constraint whatsapp_accounts_account_type_check não existe, pulando...';
    END IF;
END $$;

-- 2. Tornar phone nullable (será preenchido quando conectar)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'phone'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        ALTER COLUMN phone DROP NOT NULL;
        
        RAISE NOTICE 'Coluna phone agora é nullable';
    ELSE
        RAISE NOTICE 'Coluna phone já é nullable ou não existe';
    END IF;
END $$;

