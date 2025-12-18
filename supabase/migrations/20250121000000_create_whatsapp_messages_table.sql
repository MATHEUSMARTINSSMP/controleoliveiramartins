-- =====================================================
-- CRIAÇÃO DA TABELA WHATSAPP_MESSAGES
-- Tabela para armazenar mensagens do WhatsApp
-- preparada para integração com Chatwoot
-- Schema: sistemaretiradas
-- =====================================================

-- Cria a tabela se não existir
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_messages (
    -- Identificadores
    message_id TEXT PRIMARY KEY,
    customer_id TEXT,
    site_slug TEXT NOT NULL,
    
    -- Informações da mensagem
    phone_number TEXT NOT NULL,
    message TEXT,
    message_text TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT,
    
    -- Timestamp da mensagem (converte de milissegundos)
    timestamp TIMESTAMPTZ NOT NULL,
    
    -- Integração UazAPI
    uazapi_instance_id TEXT,
    
    -- Integração Chatwoot (preparado para inbox)
    chatwoot_conversation_id TEXT,
    chatwoot_message_id TEXT,
    chatwoot_contact_id TEXT,
    
    -- Status da mensagem
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'archived')),
    
    -- Timestamps de controle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cria índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer_id 
    ON sistemaretiradas.whatsapp_messages(customer_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_site_slug 
    ON sistemaretiradas.whatsapp_messages(site_slug);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_number 
    ON sistemaretiradas.whatsapp_messages(phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp 
    ON sistemaretiradas.whatsapp_messages(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chatwoot_conversation 
    ON sistemaretiradas.whatsapp_messages(chatwoot_conversation_id) 
    WHERE chatwoot_conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chatwoot_contact 
    ON sistemaretiradas.whatsapp_messages(chatwoot_contact_id) 
    WHERE chatwoot_contact_id IS NOT NULL;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION sistemaretiradas.update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger apenas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_whatsapp_messages_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_whatsapp_messages_updated_at
            BEFORE UPDATE ON sistemaretiradas.whatsapp_messages
            FOR EACH ROW
            EXECUTE FUNCTION sistemaretiradas.update_whatsapp_messages_updated_at();
    END IF;
END $$;

-- Comentários nas colunas para documentação
COMMENT ON TABLE sistemaretiradas.whatsapp_messages IS 'Armazena mensagens do WhatsApp para integração com Chatwoot';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.message_id IS 'ID único da mensagem (usado no ON CONFLICT)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.customer_id IS 'ID do cliente (pode ser UUID ou texto)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.site_slug IS 'Slug do site/loja';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.direction IS 'Direção da mensagem: inbound ou outbound';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.chatwoot_conversation_id IS 'ID da conversa no Chatwoot (NULL até sincronizar)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.chatwoot_message_id IS 'ID da mensagem no Chatwoot (NULL até sincronizar)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_messages.chatwoot_contact_id IS 'ID do contato no Chatwoot (NULL até sincronizar)';


