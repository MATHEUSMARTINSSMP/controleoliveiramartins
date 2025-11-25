-- =============================================================================
-- Migration: Melhorar tabela erp_sync_logs para suportar logs detalhados
-- =============================================================================
-- PASSO 9: Adicionar campos para logs detalhados
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar campos novos (se não existirem)
DO $$
BEGIN
    -- registros_atualizados
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'registros_atualizados'
    ) THEN
        ALTER TABLE erp_sync_logs ADD COLUMN registros_atualizados INTEGER DEFAULT 0;
    END IF;

    -- registros_com_erro (renomear de registros_erro se necessário)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'registros_com_erro'
    ) THEN
        -- Se existe registros_erro, renomear
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'erp_sync_logs' 
            AND column_name = 'registros_erro'
        ) THEN
            ALTER TABLE erp_sync_logs RENAME COLUMN registros_erro TO registros_com_erro;
        ELSE
            ALTER TABLE erp_sync_logs ADD COLUMN registros_com_erro INTEGER DEFAULT 0;
        END IF;
    END IF;

    -- data_inicio
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'data_inicio'
    ) THEN
        ALTER TABLE erp_sync_logs ADD COLUMN data_inicio DATE;
    END IF;

    -- data_fim
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'data_fim'
    ) THEN
        ALTER TABLE erp_sync_logs ADD COLUMN data_fim DATE;
    END IF;

    -- total_paginas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'total_paginas'
    ) THEN
        ALTER TABLE erp_sync_logs ADD COLUMN total_paginas INTEGER;
    END IF;
END $$;

-- Comentários
COMMENT ON COLUMN erp_sync_logs.registros_atualizados IS 'Número de registros atualizados (já existiam)';
COMMENT ON COLUMN erp_sync_logs.registros_com_erro IS 'Número de registros com erro na sincronização';
COMMENT ON COLUMN erp_sync_logs.data_inicio IS 'Data inicial do período sincronizado';
COMMENT ON COLUMN erp_sync_logs.data_fim IS 'Data final do período sincronizado';
COMMENT ON COLUMN erp_sync_logs.total_paginas IS 'Total de páginas processadas na sincronização';

