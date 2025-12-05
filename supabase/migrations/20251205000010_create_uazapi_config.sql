-- ============================================================================
-- Migration: Criar tabela uazapi_config para configuração global UazAPI
-- Data: 2025-12-05
-- Descrição: Tabela para armazenar configuração global da UazAPI (admin token)
-- Schema: sistemaretiradas (não elevea)
-- ============================================================================

-- Criar tabela uazapi_config
CREATE TABLE IF NOT EXISTS sistemaretiradas.uazapi_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(255) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários para documentação
COMMENT ON TABLE sistemaretiradas.uazapi_config IS 'Configuração global da UazAPI';
COMMENT ON COLUMN sistemaretiradas.uazapi_config.config_key IS 'Chave da configuração (ex: admin_token)';
COMMENT ON COLUMN sistemaretiradas.uazapi_config.config_value IS 'Valor da configuração';
COMMENT ON COLUMN sistemaretiradas.uazapi_config.description IS 'Descrição da configuração';

-- Índice
CREATE INDEX IF NOT EXISTS idx_uazapi_config_key 
  ON sistemaretiradas.uazapi_config(config_key);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_uazapi_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_uazapi_config_updated_at ON sistemaretiradas.uazapi_config;
CREATE TRIGGER trigger_update_uazapi_config_updated_at
  BEFORE UPDATE ON sistemaretiradas.uazapi_config
  FOR EACH ROW
  EXECUTE FUNCTION sistemaretiradas.update_uazapi_config_updated_at();

-- ============================================================================
-- Verificação
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'uazapi_config'
  ) THEN
    RAISE NOTICE '✅ Tabela uazapi_config criada com sucesso';
  ELSE
    RAISE EXCEPTION '❌ Falha ao criar tabela uazapi_config';
  END IF;
END $$;

