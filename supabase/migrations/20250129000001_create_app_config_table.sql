-- ============================================================================
-- Migration: Criar tabela de configuração da aplicação
-- Data: 2025-01-29
-- Descrição: Tabela para armazenar configurações sensíveis (Service Role Key, etc)
-- ============================================================================

-- Criar tabela de configuração (se não existir)
CREATE TABLE IF NOT EXISTS sistemaretiradas.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_app_config_key ON sistemaretiradas.app_config(key);

-- RLS: Apenas ADMIN pode ver/editar configurações
ALTER TABLE sistemaretiradas.app_config ENABLE ROW LEVEL SECURITY;

-- Política: Apenas ADMIN pode ver configurações
DROP POLICY IF EXISTS "app_config_select_admin" ON sistemaretiradas.app_config;
CREATE POLICY "app_config_select_admin"
  ON sistemaretiradas.app_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- Política: Apenas ADMIN pode inserir/atualizar configurações
DROP POLICY IF EXISTS "app_config_modify_admin" ON sistemaretiradas.app_config;
CREATE POLICY "app_config_modify_admin"
  ON sistemaretiradas.app_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sistemaretiradas.profiles
      WHERE id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- Comentários
COMMENT ON TABLE sistemaretiradas.app_config IS 
'Tabela para armazenar configurações sensíveis da aplicação (Service Role Key, etc). Apenas ADMIN pode acessar.';

COMMENT ON COLUMN sistemaretiradas.app_config.key IS 'Chave da configuração (ex: supabase_service_role_key)';
COMMENT ON COLUMN sistemaretiradas.app_config.value IS 'Valor da configuração (sensível, deve ser protegido)';
COMMENT ON COLUMN sistemaretiradas.app_config.description IS 'Descrição do que esta configuração faz';

-- ============================================================================
-- INSTRUÇÕES DE USO:
-- ============================================================================
-- Para inserir o Service Role Key (apenas ADMIN pode fazer isso):
--
-- INSERT INTO sistemaretiradas.app_config (key, value, description)
-- VALUES (
--   'supabase_service_role_key',
--   'SEU_SERVICE_ROLE_KEY_AQUI',
--   'Service Role Key do Supabase para chamar Edge Functions via pg_cron'
-- );
--
-- Você pode encontrar o Service Role Key em:
-- Supabase Dashboard > Settings > API > service_role (secret)
-- ============================================================================

