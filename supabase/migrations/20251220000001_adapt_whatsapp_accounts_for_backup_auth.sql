-- =====================================================
-- ADAPTAÇÃO: WHATSAPP ACCOUNTS PARA NÚMEROS RESERVA
-- =====================================================
-- Esta migration adapta a tabela whatsapp_accounts para suportar
-- autenticação completa de números reserva (BACKUP_1, BACKUP_2, BACKUP_3)
-- 
-- Números principais continuam em whatsapp_credentials (gerenciados no WhatsApp Config)
-- Números reserva ficam em whatsapp_accounts (gerenciados no Envio em Massa)
-- =====================================================

-- 1. Adicionar campos de autenticação se não existirem
DO $$ 
BEGIN
    -- uazapi_qr_code: Para armazenar QR code durante autenticação
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'uazapi_qr_code'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts
        ADD COLUMN uazapi_qr_code TEXT;
    END IF;

    -- uazapi_status: Status da conexão (connected, disconnected, qr_required, connecting, error)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND column_name = 'uazapi_status'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts
        ADD COLUMN uazapi_status TEXT 
        CHECK (uazapi_status IN ('connected', 'disconnected', 'qr_required', 'connecting', 'error', 'configured') OR uazapi_status IS NULL);
    END IF;

    -- Adicionar comentários para documentação
    COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.uazapi_qr_code IS 'QR Code gerado durante processo de autenticação WhatsApp (apenas para números reserva)';
    COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.uazapi_status IS 'Status da conexão WhatsApp: connected, disconnected, qr_required, connecting, error, configured';
    
END $$;

-- 2. Migrar registros PRIMARY existentes para BACKUP (antes de remover PRIMARY do CHECK)
-- O PRIMARY continua sendo gerenciado via whatsapp_credentials
DO $$
BEGIN
    -- Atualizar registros PRIMARY existentes para BACKUP_1 se houver
    -- (isso não deve acontecer, mas por segurança)
    UPDATE sistemaretiradas.whatsapp_accounts
    SET account_type = 'BACKUP_1'
    WHERE account_type = 'PRIMARY'
    AND NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_accounts wa2
        WHERE wa2.store_id = whatsapp_accounts.store_id
        AND wa2.account_type = 'BACKUP_1'
        AND wa2.id != whatsapp_accounts.id
    );
    
    -- Se já existir BACKUP_1, marcar PRIMARY como BACKUP_2
    UPDATE sistemaretiradas.whatsapp_accounts
    SET account_type = 'BACKUP_2'
    WHERE account_type = 'PRIMARY'
    AND EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_accounts wa2
        WHERE wa2.store_id = whatsapp_accounts.store_id
        AND wa2.account_type = 'BACKUP_1'
        AND wa2.id != whatsapp_accounts.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_accounts wa3
        WHERE wa3.store_id = whatsapp_accounts.store_id
        AND wa3.account_type = 'BACKUP_2'
        AND wa3.id != whatsapp_accounts.id
    );
    
    -- Se já existir BACKUP_1 e BACKUP_2, marcar PRIMARY como BACKUP_3
    UPDATE sistemaretiradas.whatsapp_accounts
    SET account_type = 'BACKUP_3'
    WHERE account_type = 'PRIMARY'
    AND EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_accounts wa2
        WHERE wa2.store_id = whatsapp_accounts.store_id
        AND wa2.account_type IN ('BACKUP_1', 'BACKUP_2')
        AND wa2.id != whatsapp_accounts.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.whatsapp_accounts wa3
        WHERE wa3.store_id = whatsapp_accounts.store_id
        AND wa3.account_type = 'BACKUP_3'
        AND wa3.id != whatsapp_accounts.id
    );
END $$;

-- 3. Atualizar CHECK constraint para aceitar apenas BACKUP_1, BACKUP_2, BACKUP_3
-- Isso força que números principais sejam gerenciados apenas via whatsapp_credentials
DO $$ 
BEGIN
    -- Remover constraint atual se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_accounts' 
        AND constraint_name = 'whatsapp_accounts_account_type_check'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_accounts 
        DROP CONSTRAINT whatsapp_accounts_account_type_check;
    END IF;
    
    -- Adicionar constraint sem PRIMARY (apenas reservas)
    ALTER TABLE sistemaretiradas.whatsapp_accounts
    ADD CONSTRAINT whatsapp_accounts_account_type_check 
    CHECK (account_type IN ('BACKUP_1', 'BACKUP_2', 'BACKUP_3'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_store_type 
    ON sistemaretiradas.whatsapp_accounts(store_id, account_type);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status 
    ON sistemaretiradas.whatsapp_accounts(uazapi_status) 
    WHERE uazapi_status IS NOT NULL;

-- 5. Comentários de documentação
COMMENT ON TABLE sistemaretiradas.whatsapp_accounts IS 
'Contas WhatsApp reserva para envio em massa. Números principais ficam em whatsapp_credentials. Esta tabela gerencia apenas BACKUP_1, BACKUP_2 e BACKUP_3.';

COMMENT ON COLUMN sistemaretiradas.whatsapp_accounts.account_type IS 
'Tipo da conta: BACKUP_1, BACKUP_2 ou BACKUP_3. Números PRIMARY devem ser gerenciados via whatsapp_credentials.';
