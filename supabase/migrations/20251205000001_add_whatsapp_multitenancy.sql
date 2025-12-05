-- ============================================================================
-- Migration: Adicionar suporte a WhatsApp Multi-Tenancy
-- Data: 2025-12-05
-- Descrição: Cada loja pode ter seu próprio WhatsApp conectado via UazAPI
-- ============================================================================

-- Adicionar colunas para credenciais WhatsApp/UazAPI na tabela stores
ALTER TABLE sistemaretiradas.stores 
  ADD COLUMN IF NOT EXISTS uazapi_token TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_ativo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_connection_status TEXT DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.stores.uazapi_token IS 'Token de API da UazAPI para envio de WhatsApp';
COMMENT ON COLUMN sistemaretiradas.stores.uazapi_instance_id IS 'ID da instância UazAPI conectada';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_ativo IS 'Se o módulo WhatsApp está ativo para esta loja';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_connection_status IS 'Status da conexão: disconnected, connecting, connected, error';
COMMENT ON COLUMN sistemaretiradas.stores.whatsapp_connected_at IS 'Data/hora da última conexão bem-sucedida';

-- Índice para buscar lojas com WhatsApp ativo
CREATE INDEX IF NOT EXISTS idx_stores_whatsapp_ativo 
  ON sistemaretiradas.stores(whatsapp_ativo) 
  WHERE whatsapp_ativo = true;

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'stores' 
    AND column_name = 'uazapi_token'
  ) THEN
    RAISE NOTICE '✅ Coluna uazapi_token adicionada com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Falha ao adicionar coluna uazapi_token';
  END IF;
END $$;
