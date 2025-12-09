-- =====================================================
-- CORRIGIR COLUNAS DA TABELA time_clock_digital_signatures
-- Adiciona todas as colunas que estão faltando
-- =====================================================

-- Verificar e adicionar coluna time_clock_record_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN time_clock_record_id UUID;
        
        -- Adicionar foreign key se a tabela time_clock_records existir
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_records'
        ) THEN
            ALTER TABLE sistemaretiradas.time_clock_digital_signatures
            ADD CONSTRAINT fk_time_clock_digital_signatures_record 
            FOREIGN KEY (time_clock_record_id) 
            REFERENCES sistemaretiradas.time_clock_records(id) 
            ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE '✅ Coluna time_clock_record_id adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna time_clock_record_id já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna colaboradora_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'colaboradora_id'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN colaboradora_id UUID;
        
        -- Adicionar foreign key
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'profiles'
        ) THEN
            ALTER TABLE sistemaretiradas.time_clock_digital_signatures
            ADD CONSTRAINT fk_time_clock_digital_signatures_colaboradora 
            FOREIGN KEY (colaboradora_id) 
            REFERENCES sistemaretiradas.profiles(id) 
            ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE '✅ Coluna colaboradora_id adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna colaboradora_id já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna store_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN store_id UUID;
        
        -- Adicionar foreign key
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'stores'
        ) THEN
            ALTER TABLE sistemaretiradas.time_clock_digital_signatures
            ADD CONSTRAINT fk_time_clock_digital_signatures_store 
            FOREIGN KEY (store_id) 
            REFERENCES sistemaretiradas.stores(id) 
            ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE '✅ Coluna store_id adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna store_id já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna password_hash
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN password_hash TEXT;
        
        RAISE NOTICE '✅ Coluna password_hash adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna password_hash já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna device_info
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'device_info'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN device_info JSONB;
        
        RAISE NOTICE '✅ Coluna device_info adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna device_info já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna ip_address
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN ip_address INET;
        
        RAISE NOTICE '✅ Coluna ip_address adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna ip_address já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna rep_identity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'rep_identity'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN rep_identity TEXT;
        
        RAISE NOTICE '✅ Coluna rep_identity adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna rep_identity já existe';
    END IF;
END $$;

-- Verificar e adicionar coluna created_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        RAISE NOTICE '✅ Coluna created_at adicionada';
    ELSE
        RAISE NOTICE '✅ Coluna created_at já existe';
    END IF;
END $$;

-- Adicionar constraint NOT NULL nas colunas obrigatórias (após adicionar valores padrão se necessário)
DO $$
BEGIN
    -- Tornar time_clock_record_id NOT NULL se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'time_clock_record_id'
        AND is_nullable = 'YES'
    ) THEN
        -- Só tornar NOT NULL se não houver registros ou se todos tiverem valor
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ALTER COLUMN time_clock_record_id SET NOT NULL;
        
        RAISE NOTICE '✅ time_clock_record_id definido como NOT NULL';
    END IF;
    
    -- Tornar colaboradora_id NOT NULL se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'colaboradora_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ALTER COLUMN colaboradora_id SET NOT NULL;
        
        RAISE NOTICE '✅ colaboradora_id definido como NOT NULL';
    END IF;
    
    -- Tornar store_id NOT NULL se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'store_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ALTER COLUMN store_id SET NOT NULL;
        
        RAISE NOTICE '✅ store_id definido como NOT NULL';
    END IF;
    
    -- Tornar password_hash NOT NULL se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'password_hash'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ALTER COLUMN password_hash SET NOT NULL;
        
        RAISE NOTICE '✅ password_hash definido como NOT NULL';
    END IF;
    
    -- Tornar rep_identity NOT NULL se não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'time_clock_digital_signatures'
        AND column_name = 'rep_identity'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ALTER COLUMN rep_identity SET NOT NULL;
        
        RAISE NOTICE '✅ rep_identity definido como NOT NULL';
    END IF;
END $$;

-- Adicionar constraint UNIQUE em time_clock_record_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'time_clock_digital_signatures_time_clock_record_id_key'
    ) THEN
        ALTER TABLE sistemaretiradas.time_clock_digital_signatures
        ADD CONSTRAINT time_clock_digital_signatures_time_clock_record_id_key 
        UNIQUE(time_clock_record_id);
        
        RAISE NOTICE '✅ Constraint UNIQUE em time_clock_record_id adicionada';
    ELSE
        RAISE NOTICE '✅ Constraint UNIQUE em time_clock_record_id já existe';
    END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_record 
ON sistemaretiradas.time_clock_digital_signatures(time_clock_record_id);

CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_colaboradora 
ON sistemaretiradas.time_clock_digital_signatures(colaboradora_id);

CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_store 
ON sistemaretiradas.time_clock_digital_signatures(store_id);

CREATE INDEX IF NOT EXISTS idx_time_clock_digital_signatures_created_at 
ON sistemaretiradas.time_clock_digital_signatures(created_at DESC);

-- Habilitar RLS se não estiver habilitado
ALTER TABLE sistemaretiradas.time_clock_digital_signatures ENABLE ROW LEVEL SECURITY;

-- Remover e recriar políticas RLS
DROP POLICY IF EXISTS "time_clock_digital_signatures_colaboradora_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_admin_read" ON sistemaretiradas.time_clock_digital_signatures;
DROP POLICY IF EXISTS "time_clock_digital_signatures_insert" ON sistemaretiradas.time_clock_digital_signatures;

CREATE POLICY "time_clock_digital_signatures_colaboradora_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

CREATE POLICY "time_clock_digital_signatures_admin_read"
ON sistemaretiradas.time_clock_digital_signatures
FOR SELECT
TO authenticated
USING (
    store_id IN (
        SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
    )
);

CREATE POLICY "time_clock_digital_signatures_insert"
ON sistemaretiradas.time_clock_digital_signatures
FOR INSERT
TO authenticated
WITH CHECK (colaboradora_id = auth.uid());

RAISE NOTICE '✅ Script de correção concluído!';

