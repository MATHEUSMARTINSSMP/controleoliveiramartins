-- ============================================================================
-- Migration: Criar tabela whatsapp_credentials para autenticação WhatsApp
-- Data: 2025-12-05
-- Descrição: Tabela para armazenar credenciais WhatsApp/UazAPI por customer/site
-- Schema: sistemaretiradas (não elevea)
-- ============================================================================

-- Criar tabela whatsapp_credentials
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_credentials (
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  uazapi_instance_id TEXT,
  uazapi_token TEXT,
  uazapi_phone_number TEXT,
  uazapi_qr_code TEXT,
  uazapi_status VARCHAR(50) DEFAULT 'disconnected',
  whatsapp_instance_name VARCHAR(255),
  chatwoot_base_url TEXT,
  chatwoot_account_id INTEGER,
  chatwoot_access_token TEXT,
  chatwoot_inbox_id INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  instance_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, site_slug)
);

-- Comentários para documentação
COMMENT ON TABLE sistemaretiradas.whatsapp_credentials IS 'Credenciais WhatsApp/UazAPI por customer e site';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.customer_id IS 'ID do cliente (email)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.site_slug IS 'Slug do site';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_instance_id IS 'ID da instância UazAPI';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_token IS 'Token da instância UazAPI (para enviar mensagens)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_phone_number IS 'Número de telefone conectado';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_qr_code IS 'QR Code para conexão (base64)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_status IS 'Status da conexão: disconnected, connecting, connected, error';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.whatsapp_instance_name IS 'Nome da instância WhatsApp';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.chatwoot_base_url IS 'URL base do Chatwoot';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.chatwoot_account_id IS 'ID da conta Chatwoot';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.chatwoot_access_token IS 'Token de acesso Chatwoot';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.chatwoot_inbox_id IS 'ID da inbox Chatwoot';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.status IS 'Status do registro: active, inactive';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.instance_metadata IS 'Metadados completos da instância (JSON)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_customer_site 
  ON sistemaretiradas.whatsapp_credentials(customer_id, site_slug);

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_status 
  ON sistemaretiradas.whatsapp_credentials(status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_instance_id 
  ON sistemaretiradas.whatsapp_credentials(uazapi_instance_id) 
  WHERE uazapi_instance_id IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_whatsapp_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_whatsapp_credentials_updated_at ON sistemaretiradas.whatsapp_credentials;
CREATE TRIGGER trigger_update_whatsapp_credentials_updated_at
  BEFORE UPDATE ON sistemaretiradas.whatsapp_credentials
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_whatsapp_credentials_updated_at();

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'whatsapp_credentials'
  ) THEN
    RAISE NOTICE '✅ Tabela whatsapp_credentials criada com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar tabela whatsapp_credentials';
  END IF;
END $$;

