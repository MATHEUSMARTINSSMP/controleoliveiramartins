-- =============================================================================
-- TABELA: tiny_api_credentials
-- =============================================================================
-- Armazena credenciais e tokens OAuth do Tiny ERP de forma segura
-- Acessível apenas ao ADMIN
-- =============================================================================

SET search_path TO sistemaretiradas, public;

CREATE TABLE IF NOT EXISTS tiny_api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL, -- Armazenar de forma segura (considerar criptografia)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'DISCONNECTED', -- 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tiny_api_credentials_active ON tiny_api_credentials(active) WHERE active = true;

-- Comentários
COMMENT ON TABLE tiny_api_credentials IS 'Credenciais e tokens OAuth do Tiny ERP';
COMMENT ON COLUMN tiny_api_credentials.sync_status IS 'Status da conexão: CONNECTED, DISCONNECTED, ERROR';

-- RLS: Apenas ADMIN pode acessar
ALTER TABLE tiny_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_tiny_api_credentials_all" ON tiny_api_credentials
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_tiny_api_credentials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_tiny_api_credentials_updated_at
    BEFORE UPDATE ON tiny_api_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_tiny_api_credentials_updated_at();

