-- =====================================================
-- TABELA DE ASSINATURAS DIGITAIS DE REGISTRO DE PONTO
-- Conforme Portaria 671/2021 (REP-P)
-- Script corrigido que verifica dependências
-- =====================================================

-- 1. Verificar se a tabela time_clock_records existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_records'
    ) THEN
        RAISE EXCEPTION 'A tabela sistemaretiradas.time_clock_records não existe! Execute primeiro CRIAR_TABELA_TIMECLOCK_RECORDS.sql';
    END IF;
END $$;

-- 2. Se a tabela já existe, verificar se precisa adicionar a coluna
DO $$
BEGIN
    -- Se a tabela existe mas não tem a coluna time_clock_record_id
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
    ) THEN
        -- Adicionar a coluna
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN time_clock_record_id UUID REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE;
        
        -- Adicionar constraint UNIQUE se não existir
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'time_clock_digital_signatures_time_clock_record_id_key'
        ) THEN
            ALTER TABLE sistemaretiradas.time_clock_digital_signatures
            ADD CONSTRAINT time_clock_digital_signatures_time_clock_record_id_key UNIQUE(time_clock_record_id);
        END IF;
        
        -- Adicionar índice se não existir
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'sistemaretiradas' 
            AND tablename = 'time_clock_digital_signatures'
            AND indexname = 'idx_time_clock_digital_signatures_record'
        ) THEN
            CREATE INDEX idx_time_clock_digital_signatures_record 
            ON sistemaretiradas.time_clock_digital_signatures(time_clock_record_id);
        END IF;
        
        RAISE NOTICE 'Coluna time_clock_record_id adicionada à tabela existente';
        RETURN;
    END IF;
END $$;

-- 3. Se a tabela não existe, criar completa
CREATE TABLE IF NOT EXISTS sistemaretiradas.time_clock_digital_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Referência ao registro de ponto
    time_clock_record_id UUID NOT NULL REFERENCES sistemaretiradas.time_clock_records(id) ON DELETE CASCADE,
    
    -- Referências para auditoria
    colaboradora_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Hash da assinatura digital (gerado a partir do PIN + dados do registro)
    password_hash TEXT NOT NULL,
    
    -- Informações do dispositivo (JSONB para flexibilidade)
    device_info JSONB,
    
    -- IP address (se disponível)
    ip_address INET,
    
    -- Identidade REP conforme Portaria 671/2021
    rep_identity TEXT NOT NULL,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Índice único para garantir uma assinatura por registro
    UNIQUE(time_clock_record_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_record ON sistemaretiradas.time_clock_digital_signatures(time_clock_record_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_colaboradora ON sistemaretiradas.time_clock_digital_signatures(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_store ON sistemaretiradas.time_clock_digital_signatures(store_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_created_at ON sistemaretiradas.time_clock_digital_signatures(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE sistemaretiradas.time_clock_digital_signatures ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "time_clock_digital_signatures_colaboradora_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_admin_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_insert" ON sistemaretiradas.time_clock_digital_signatures;

-- Política: Colaboradora vê apenas suas próprias assinaturas
CREATE POLICY "time_clock_digital_signatures_colaboradora_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política: Admin vê assinaturas da sua loja
CREATE POLICY "time_clock_digital_signatures_admin_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

-- Política: Colaboradora pode inserir suas próprias assinaturas (via função RPC ou diretamente)
CREATE POLICY "time_clock_digital_signatures_insert"
ON sistemaretiradas.time_clock_digital_signatures
FOR INSERT
TO authenticated
WITH CHECK (colaboradora_id = auth.uid());

-- Comentários para documentação
COMMENT ON TABLE sistemaretiradas.time_clock_digital_signatures IS 'Armazena assinaturas digitais vinculadas aos registros de ponto (REP-P compliance - Portaria 671/2021)';
COMMENT ON COLUMN sistemaretiradas.time_clock_digital_signatures.password_hash IS 'Hash da assinatura digital gerado a partir do PIN + dados do registro';
COMMENT ON COLUMN sistemaretiradas.time_clock_digital_signatures.device_info IS 'Informações do dispositivo em formato JSON (userAgent, platform, screen, etc.)';
COMMENT ON COLUMN sistemaretiradas.time_clock_digital_signatures.rep_identity IS 'Identidade REP conforme Portaria 671/2021';

