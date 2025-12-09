-- =====================================================
-- SCRIPT DE VERIFICAÇÃO E CORREÇÃO DAS TABELAS DE PONTO
-- Execute este script para verificar o estado das tabelas
-- =====================================================

-- Verificar se time_clock_records existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_records'
        ) THEN '✅ Tabela time_clock_records EXISTE'
        ELSE '❌ Tabela time_clock_records NÃO EXISTE - Execute CRIAR_TABELA_TIMECLOCK_RECORDS.sql primeiro!'
    END AS status_time_clock_records;

-- Verificar se time_clock_digital_signatures existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
        ) THEN '✅ Tabela time_clock_digital_signatures EXISTE'
        ELSE '❌ Tabela time_clock_digital_signatures NÃO EXISTE'
    END AS status_time_clock_digital_signatures;

-- Verificar colunas de time_clock_digital_signatures (se existir)
DO $$
DECLARE
    rec RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
    ) THEN
        RAISE NOTICE 'Colunas da tabela time_clock_digital_signatures:';
        FOR rec IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - % (%)', rec.column_name, rec.data_type;
        END LOOP;
        
        -- Verificar se time_clock_record_id existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            AND column_name = 'time_clock_record_id'
        ) THEN
            RAISE WARNING '⚠️ Coluna time_clock_record_id NÃO EXISTE! Execute CORRIGIR_COLUNAS_TIMECLOCK_DIGITAL_SIGNATURES.sql';
        ELSE
            RAISE NOTICE '✅ Coluna time_clock_record_id existe';
        END IF;
        
        -- Verificar outras colunas importantes
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            AND column_name = 'password_hash'
        ) THEN
            RAISE WARNING '⚠️ Coluna password_hash NÃO EXISTE! Execute CORRIGIR_COLUNAS_TIMECLOCK_DIGITAL_SIGNATURES.sql';
        ELSE
            RAISE NOTICE '✅ Coluna password_hash existe';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            AND column_name = 'device_info'
        ) THEN
            RAISE WARNING '⚠️ Coluna device_info NÃO EXISTE! Execute CORRIGIR_COLUNAS_TIMECLOCK_DIGITAL_SIGNATURES.sql';
        ELSE
            RAISE NOTICE '✅ Coluna device_info existe';
        END IF;
    END IF;
END $$;

