-- =====================================================
-- REMOVER CONSTRAINT UNIQUE DE STORE_ID + ACCOUNT_TYPE
-- =====================================================
-- A constraint UNIQUE(store_id, account_type) foi criada na criação inicial
-- mas não é mais necessária pois estamos usando is_backup1/2/3 ao invés de account_type
-- =====================================================

-- Remover constraint única se existir
DO $$ 
BEGIN
    -- Tentar remover como constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_store_id_account_type_key'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_store_id_account_type_key;
        
        RAISE NOTICE 'Constraint UNIQUE whatsapp_accounts_store_id_account_type_key removida com sucesso';
    END IF;

    -- Tentar remover como índice único (às vezes é criado como índice)
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_accounts' 
        AND indexname = 'whatsapp_accounts_store_id_account_type_key'
    ) THEN
        DROP INDEX IF EXISTS sistemaretiradas.whatsapp_accounts_store_id_account_type_key;
        
        RAISE NOTICE 'Índice único whatsapp_accounts_store_id_account_type_key removido com sucesso';
    END IF;

    -- Tentar buscar qualquer constraint ou índice que contenha store_id e account_type
    -- (pode ter nomes diferentes)
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'sistemaretiradas.whatsapp_accounts'::regclass
        AND contype = 'u'  -- unique constraint
        AND conname LIKE '%store_id%account_type%'
    ) LOOP
        EXECUTE format('ALTER TABLE sistemaretiradas.whatsapp_accounts DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Constraint única removida: %', r.conname;
    END LOOP;

    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_accounts' 
        AND indexname LIKE '%store_id%account_type%'
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS sistemaretiradas.%I', r.indexname);
        RAISE NOTICE 'Índice único removido: %', r.indexname;
    END LOOP;

END $$;

-- Criar nova constraint única baseada em is_backup1/2/3
-- Garantir que apenas um número pode ser backup1, backup2 ou backup3 por loja
DO $$
BEGIN
    -- Remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_store_id_backup_unique'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_store_id_backup_unique;
    END IF;

    -- Criar constraint única: apenas um backup1, um backup2 e um backup3 por loja
    -- Usando partial unique indexes para cada tipo de backup
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup1_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup1 = true;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup2_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup2 = true;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup3_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup3 = true;

    RAISE NOTICE 'Constraints únicas para is_backup1/2/3 criadas com sucesso';
END $$;

-- Comentário
COMMENT ON INDEX sistemaretiradas.whatsapp_accounts_store_id_backup1_unique IS 
'Apenas um número pode ser backup1 por loja';

COMMENT ON INDEX sistemaretiradas.whatsapp_accounts_store_id_backup2_unique IS 
'Apenas um número pode ser backup2 por loja';

COMMENT ON INDEX sistemaretiradas.whatsapp_accounts_store_id_backup3_unique IS 
'Apenas um número pode ser backup3 por loja';

