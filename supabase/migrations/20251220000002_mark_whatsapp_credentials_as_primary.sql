-- =====================================================
-- MARCAR WHATSAPP_CREDENTIALS COMO PRINCIPAIS
-- =====================================================
-- Esta migration adiciona uma coluna para identificar explicitamente
-- que whatsapp_credentials contém apenas números principais (não reservas)
-- 
-- Números reserva são gerenciados em whatsapp_accounts (BACKUP_1, BACKUP_2, BACKUP_3)
-- =====================================================

-- Adicionar coluna is_backup (false = principal, true = reserva)
-- Por padrão, whatsapp_credentials sempre terá is_backup = false (são todos principais)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_credentials' 
        AND column_name = 'is_backup'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_credentials
        ADD COLUMN is_backup BOOLEAN NOT NULL DEFAULT false;
        
        -- Como a coluna é NOT NULL DEFAULT false, não é necessário UPDATE
        -- O DEFAULT já garante que todos os registros existentes terão false
    END IF;
END $$;

-- Adicionar comentário para documentação
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.is_backup IS 
'Identifica se é número reserva (true) ou principal (false). WhatsApp credentials sempre terá false (principais). Reservas ficam em whatsapp_accounts.';

-- Índice para queries de filtragem (opcional, mas útil)
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_is_backup 
    ON sistemaretiradas.whatsapp_credentials(is_backup) 
    WHERE is_backup = false;

-- Comentário na tabela para clareza
COMMENT ON TABLE sistemaretiradas.whatsapp_credentials IS 
'Credenciais WhatsApp/UazAPI para números PRINCIPAIS das lojas. Números reserva (BACKUP) são gerenciados na tabela whatsapp_accounts.';

