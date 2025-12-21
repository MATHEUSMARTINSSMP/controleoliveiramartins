-- =====================================================
-- FORÇAR REMOÇÃO DA CONSTRAINT UNIQUE(store_id, account_type)
-- =====================================================
-- Esta migration força a remoção da constraint que está causando erro
-- ao criar números de backup. A constraint foi substituída por índices
-- parciais baseados em is_backup1/2/3 na migration anterior.
-- =====================================================

DO $$ 
DECLARE
    constraint_exists BOOLEAN;
    index_exists BOOLEAN;
    r RECORD;
BEGIN
    -- Verificar e remover constraint se existir
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_store_id_account_type_key'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_store_id_account_type_key;
        RAISE NOTICE '✅ Constraint whatsapp_accounts_store_id_account_type_key removida';
    ELSE
        RAISE NOTICE '⚠️ Constraint whatsapp_accounts_store_id_account_type_key não encontrada';
    END IF;

    -- Verificar e remover índice único se existir (às vezes é criado como índice)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_accounts' 
        AND indexname = 'whatsapp_accounts_store_id_account_type_key'
    ) INTO index_exists;

    IF index_exists THEN
        DROP INDEX IF EXISTS sistemaretiradas.whatsapp_accounts_store_id_account_type_key;
        RAISE NOTICE '✅ Índice whatsapp_accounts_store_id_account_type_key removido';
    ELSE
        RAISE NOTICE '⚠️ Índice whatsapp_accounts_store_id_account_type_key não encontrado';
    END IF;

    -- Tentar remover qualquer constraint única que contenha store_id e account_type
    -- (pode ter nomes diferentes dependendo da versão do PostgreSQL)
    FOR r IN (
        SELECT conname, contype
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'sistemaretiradas'
        AND t.relname = 'whatsapp_accounts'
        AND c.contype = 'u'  -- unique constraint
        AND (
            conname LIKE '%store_id%account_type%'
            OR conname LIKE '%account_type%store_id%'
        )
    ) LOOP
        EXECUTE format('ALTER TABLE sistemaretiradas.whatsapp_accounts DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE '✅ Constraint única removida: %', r.conname;
    END LOOP;

    -- Tentar remover qualquer índice único que contenha store_id e account_type
    FOR r IN (
        SELECT indexname
        FROM pg_indexes 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'whatsapp_accounts' 
        AND (
            indexname LIKE '%store_id%account_type%'
            OR indexname LIKE '%account_type%store_id%'
        )
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS sistemaretiradas.%I', r.indexname);
        RAISE NOTICE '✅ Índice único removido: %', r.indexname;
    END LOOP;

END $$;

-- Garantir que os índices parciais para is_backup1/2/3 existem
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup1_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup1 = true;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup2_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup2 = true;

    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_store_id_backup3_unique
        ON sistemaretiradas.whatsapp_accounts(store_id)
        WHERE is_backup3 = true;

    RAISE NOTICE '✅ Índices parciais para is_backup1/2/3 verificados/criados';
END $$;

