-- =====================================================
-- CORRIGIR COLUNAS DUPLICADAS (registro_id e time_clock_record_id)
-- Remove registro_id se time_clock_record_id já existir
-- =====================================================

DO $$
DECLARE
    tem_registro_id BOOLEAN;
    tem_time_clock_record_id BOOLEAN;
BEGIN
    -- Verificar quais colunas existem
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'registro_id'
    ) INTO tem_registro_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
    ) INTO tem_time_clock_record_id;
    
    RAISE NOTICE 'Estado das colunas:';
    RAISE NOTICE '  - registro_id existe: %', tem_registro_id;
    RAISE NOTICE '  - time_clock_record_id existe: %', tem_time_clock_record_id;
    
    -- Se ambas existem, precisamos decidir o que fazer
    IF tem_registro_id AND tem_time_clock_record_id THEN
        RAISE NOTICE '⚠️ Ambas as colunas existem!';
        
        -- Verificar se registro_id tem dados e time_clock_record_id está NULL
        -- Se sim, copiar dados de registro_id para time_clock_record_id
        DO $inner$
        DECLARE
            count_registro_id INTEGER;
            count_time_clock_record_id INTEGER;
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.%I WHERE registro_id IS NOT NULL', 
                'sistemaretiradas', 'time_clock_digital_signatures')
            INTO count_registro_id;
            
            EXECUTE format('SELECT COUNT(*) FROM %I.%I WHERE time_clock_record_id IS NOT NULL', 
                'sistemaretiradas', 'time_clock_digital_signatures')
            INTO count_time_clock_record_id;
            
            RAISE NOTICE 'Dados: registro_id tem % registros, time_clock_record_id tem % registros', 
                count_registro_id, count_time_clock_record_id;
            
            -- Se registro_id tem dados e time_clock_record_id está vazio, copiar
            IF count_registro_id > 0 AND count_time_clock_record_id = 0 THEN
                RAISE NOTICE 'Copiando dados de registro_id para time_clock_record_id...';
                EXECUTE format('UPDATE %I.%I SET time_clock_record_id = registro_id WHERE time_clock_record_id IS NULL', 
                    'sistemaretiradas', 'time_clock_digital_signatures');
                RAISE NOTICE '✅ Dados copiados!';
            END IF;
        END $inner$;
        
        -- Remover constraint e índice de registro_id se existirem
        DO $inner$
        DECLARE
            constraint_name TEXT;
        BEGIN
            -- Remover constraint UNIQUE de registro_id se existir
            FOR constraint_name IN
                SELECT conname FROM pg_constraint 
                WHERE conrelid = 'sistemaretiradas.time_clock_digital_signatures'::regclass
                AND contype = 'u'
                AND conname LIKE '%registro_id%'
            LOOP
                EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 
                    'sistemaretiradas', 'time_clock_digital_signatures', constraint_name);
                RAISE NOTICE '✅ Constraint removida: %', constraint_name;
            END LOOP;
        END $inner$;
        
        -- Remover índices de registro_id se existirem
        DO $inner$
        DECLARE
            index_name TEXT;
        BEGIN
            FOR index_name IN
                SELECT indexname FROM pg_indexes 
                WHERE schemaname = 'sistemaretiradas' 
                AND tablename = 'time_clock_digital_signatures'
                AND indexname LIKE '%registro_id%'
                AND indexname NOT LIKE '%time_clock_record_id%'
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS %I.%I', 'sistemaretiradas', index_name);
                RAISE NOTICE '✅ Índice removido: %', index_name;
            END LOOP;
        END $inner$;
        
        -- Remover foreign key de registro_id se existir
        DO $inner$
        DECLARE
            constraint_name TEXT;
        BEGIN
            FOR constraint_name IN
                SELECT conname FROM pg_constraint 
                WHERE conrelid = 'sistemaretiradas.time_clock_digital_signatures'::regclass
                AND contype = 'f'
                AND conname LIKE '%registro_id%'
            LOOP
                EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 
                    'sistemaretiradas', 'time_clock_digital_signatures', constraint_name);
                RAISE NOTICE '✅ Foreign key removida: %', constraint_name;
            END LOOP;
        END $inner$;
        
        -- Agora remover a coluna registro_id
        RAISE NOTICE 'Removendo coluna registro_id...';
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        DROP COLUMN IF EXISTS registro_id;
        
        RAISE NOTICE '✅ Coluna registro_id removida!';
        
    ELSIF tem_registro_id AND NOT tem_time_clock_record_id THEN
        -- Só tem registro_id, renomear
        RAISE NOTICE 'Renomeando registro_id para time_clock_record_id...';
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        RENAME COLUMN registro_id TO time_clock_record_id;
        RAISE NOTICE '✅ Coluna renomeada!';
        
    ELSIF NOT tem_registro_id AND tem_time_clock_record_id THEN
        -- Já está correto
        RAISE NOTICE '✅ Coluna já está correta: time_clock_record_id';
        
    ELSE
        -- Nenhuma das duas existe
        RAISE WARNING '❌ Nenhuma das colunas existe! Execute CORRIGIR_COLUNAS_TIMECLOCK_DIGITAL_SIGNATURES.sql';
    END IF;
    
    -- Verificar resultado final
    RAISE NOTICE '';
    RAISE NOTICE 'Verificação final:';
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
    ) THEN
        RAISE NOTICE '✅ time_clock_record_id existe';
    ELSE
        RAISE WARNING '❌ time_clock_record_id NÃO existe';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'registro_id'
    ) THEN
        RAISE WARNING '⚠️ registro_id ainda existe!';
    ELSE
        RAISE NOTICE '✅ registro_id removida';
    END IF;
    
END $$;

-- Mostrar estrutura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'time_clock_digital_signatures'
AND column_name IN ('registro_id', 'time_clock_record_id')
ORDER BY column_name;

