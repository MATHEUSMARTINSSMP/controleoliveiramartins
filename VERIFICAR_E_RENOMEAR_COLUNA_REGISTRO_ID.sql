-- =====================================================
-- VERIFICAR E CORRIGIR NOME DA COLUNA
-- A tabela pode ter registro_id ou time_clock_record_id
-- =====================================================

DO $$
BEGIN
    -- Verificar se existe coluna registro_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'registro_id'
    ) THEN
        RAISE NOTICE '⚠️ Coluna encontrada: registro_id';
        RAISE NOTICE 'Renomeando para time_clock_record_id...';
        
        -- Renomear a coluna
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        RENAME COLUMN registro_id TO time_clock_record_id;
        
        RAISE NOTICE '✅ Coluna renomeada com sucesso!';
        
        -- Verificar se precisa renomear constraint
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname LIKE '%registro_id%'
            AND conrelid = 'sistemaretiradas.time_clock_digital_signatures'::regclass
        ) THEN
            -- Renomear constraint UNIQUE se existir
            DO $inner$
            DECLARE
                old_constraint_name TEXT;
                new_constraint_name TEXT := 'time_clock_digital_signatures_time_clock_record_id_key';
            BEGIN
                SELECT conname INTO old_constraint_name
                FROM pg_constraint 
                WHERE conname LIKE '%registro_id%'
                AND conrelid = 'sistemaretiradas.time_clock_digital_signatures'::regclass
                LIMIT 1;
                
                IF old_constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE sistemaretiradas.time_clock_digital_signatures RENAME CONSTRAINT %I TO %I', 
                        old_constraint_name, new_constraint_name);
                    RAISE NOTICE '✅ Constraint renomeada: % -> %', old_constraint_name, new_constraint_name;
                END IF;
            END $inner$;
        END IF;
        
        -- Verificar se precisa renomear índice
        IF EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'sistemaretiradas' 
            AND tablename = 'time_clock_digital_signatures'
            AND indexname LIKE '%registro_id%'
        ) THEN
            -- Renomear índices se existirem
            DO $inner$
            DECLARE
                old_index_name TEXT;
                new_index_name TEXT := 'idx_time_clock_digital_signatures_record';
            BEGIN
                SELECT indexname INTO old_index_name
                FROM pg_indexes 
                WHERE schemaname = 'sistemaretiradas' 
                AND tablename = 'time_clock_digital_signatures'
                AND indexname LIKE '%registro_id%'
                LIMIT 1;
                
                IF old_index_name IS NOT NULL AND old_index_name != new_index_name THEN
                    EXECUTE format('ALTER INDEX sistemaretiradas.%I RENAME TO %I', 
                        old_index_name, new_index_name);
                    RAISE NOTICE '✅ Índice renomeado: % -> %', old_index_name, new_index_name;
                END IF;
            END $inner$;
        END IF;
        
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
    ) THEN
        RAISE NOTICE '✅ Coluna já está com o nome correto: time_clock_record_id';
    ELSE
        RAISE WARNING '❌ Nenhuma das colunas (registro_id ou time_clock_record_id) foi encontrada!';
    END IF;
END $$;

-- Verificar resultado final
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'time_clock_digital_signatures'
AND column_name IN ('registro_id', 'time_clock_record_id')
ORDER BY column_name;

