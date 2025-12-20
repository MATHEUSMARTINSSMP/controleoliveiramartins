-- =====================================================
-- SIMPLIFICAR: USAR COLUNAS BOOLEAN PARA BACKUP
-- =====================================================
-- Ao invés de account_type com BACKUP_1/2/3, usar colunas booleanas
-- Mais simples para o frontend selecionar
-- =====================================================

-- 1. Adicionar colunas booleanas para backup
DO $$ 
BEGIN
    -- is_backup1
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'is_backup1'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts
        ADD COLUMN is_backup1 BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- is_backup2
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'is_backup2'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts
        ADD COLUMN is_backup2 BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- is_backup3
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'is_backup3'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts
        ADD COLUMN is_backup3 BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Migrar dados existentes de account_type para boolean
-- BACKUP_1 -> is_backup1 = true
-- BACKUP_2 -> is_backup2 = true
-- BACKUP_3 -> is_backup3 = true
UPDATE sistemaretiradas.whatsapp_accounts
SET 
    is_backup1 = CASE WHEN account_type = 'BACKUP_1' THEN true ELSE false END,
    is_backup2 = CASE WHEN account_type = 'BACKUP_2' THEN true ELSE false END,
    is_backup3 = CASE WHEN account_type = 'BACKUP_3' THEN true ELSE false END
WHERE account_type IN ('BACKUP_1', 'BACKUP_2', 'BACKUP_3');

-- 3. Adicionar constraint para garantir que apenas uma coluna seja true
-- (um número só pode ser backup1 OU backup2 OU backup3, não múltiplos)
DO $$
BEGIN
    -- Remover constraint antiga se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_only_one_backup_check'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_only_one_backup_check;
    END IF;
    
    -- Criar constraint: apenas uma das 3 colunas pode ser true
    ALTER TABLE sistemaretiradas.whatsapp_accounts
    ADD CONSTRAINT whatsapp_accounts_only_one_backup_check 
    CHECK (
        (is_backup1::int + is_backup2::int + is_backup3::int) <= 1
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Remover constraint antiga de account_type (não vamos mais usar)
-- Mas manter a coluna account_type por compatibilidade (pode estar sendo usada em algum lugar)
-- Apenas não vamos mais restringir os valores

-- 5. Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.is_backup1 IS 
'Indica se este é o número reserva 1 (primeiro backup) para a loja. Apenas um número pode ser backup1 por loja.';

COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.is_backup2 IS 
'Indica se este é o número reserva 2 (segundo backup) para a loja. Apenas um número pode ser backup2 por loja.';

COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.is_backup3 IS 
'Indica se este é o número reserva 3 (terceiro backup) para a loja. Apenas um número pode ser backup3 por loja.';

-- 6. Índices para performance (busca por backup1, backup2, backup3)
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_is_backup1 
    ON sistemaretiradas.whatsapp_accounts(store_id, is_backup1) 
    WHERE is_backup1 = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_is_backup2 
    ON sistemaretiradas.whatsapp_accounts(store_id, is_backup2) 
    WHERE is_backup2 = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_is_backup3 
    ON sistemaretiradas.whatsapp_accounts(store_id, is_backup3) 
    WHERE is_backup3 = true;

-- 7. Comentário na tabela
COMMENT ON TABLE sistemaretiradas.whatsapp_accounts IS 
'Contas WhatsApp reserva para envio em massa. Use is_backup1, is_backup2 ou is_backup3 para identificar qual número reserva é. Números principais ficam em whatsapp_credentials.';

