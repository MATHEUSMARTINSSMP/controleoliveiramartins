-- =============================================================================
-- REFATORAÇÃO: Integrações ERP por Loja (Multi-Sistema)
-- =============================================================================
-- Cada LOJA pode ter integração com diferentes sistemas ERP
-- Suporta: Tiny, Bling, Microvix, Conta Azul, etc.
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. RENOMEAR E REFATORAR TABELA
-- =============================================================================
-- Renomear de tiny_api_credentials para erp_integrations (genérico)
-- Adicionar store_id (cada loja tem sua integração)
-- Adicionar sistema_erp (Tiny, Bling, Microvix, Conta Azul, etc)

-- Primeiro, criar nova tabela com estrutura correta
CREATE TABLE IF NOT EXISTS erp_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sistema_erp TEXT NOT NULL, -- 'TINY', 'BLING', 'MICROVIX', 'CONTA_AZUL', etc (apenas informativo)
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'DISCONNECTED', -- 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
    error_message TEXT,
    config_adicional JSONB, -- Configurações específicas de cada sistema
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    UNIQUE(store_id) -- Cada loja tem apenas UMA integração ERP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_erp_integrations_store ON erp_integrations(store_id);
CREATE INDEX IF NOT EXISTS idx_erp_integrations_sistema ON erp_integrations(sistema_erp);
CREATE INDEX IF NOT EXISTS idx_erp_integrations_active ON erp_integrations(active) WHERE active = true;

-- Comentários
COMMENT ON TABLE erp_integrations IS 'Integrações ERP por loja - Cada loja tem apenas UMA integração com um sistema ERP';
COMMENT ON COLUMN erp_integrations.store_id IS 'ID da loja - cada loja tem suas próprias credenciais (UNIQUE)';
COMMENT ON COLUMN erp_integrations.sistema_erp IS 'Sistema ERP utilizado: TINY, BLING, MICROVIX, CONTA_AZUL, etc (apenas informativo)';
COMMENT ON COLUMN erp_integrations.config_adicional IS 'Configurações específicas de cada sistema em JSON';

-- =============================================================================
-- 2. MIGRAR DADOS DA TABELA ANTIGA (se existir)
-- =============================================================================
-- Se tiny_api_credentials existir e tiver dados, migrar para erp_integrations
DO $$
DECLARE
    v_record RECORD;
    v_store_id UUID;
BEGIN
    -- Verificar se a tabela antiga existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_api_credentials'
    ) THEN
        -- Migrar dados (assumindo que tenant_id pode ser usado para encontrar store_id)
        -- Por enquanto, se não houver tenant_id, usar primeira loja ativa como padrão
        FOR v_record IN 
            SELECT * FROM sistemaretiradas.tiny_api_credentials WHERE active = true
        LOOP
            -- Se tiver tenant_id, tentar encontrar loja do tenant
            -- Se não, usar primeira loja ativa
            SELECT id INTO v_store_id 
            FROM sistemaretiradas.stores 
            WHERE active = true 
            LIMIT 1;
            
            IF v_store_id IS NOT NULL THEN
                INSERT INTO erp_integrations (
                    store_id,
                    sistema_erp,
                    client_id,
                    client_secret,
                    access_token,
                    refresh_token,
                    token_expires_at,
                    last_sync_at,
                    sync_status,
                    error_message,
                    active,
                    created_at,
                    updated_at
                )
                VALUES (
                    v_store_id,
                    'TINY', -- Sistema padrão
                    v_record.client_id,
                    v_record.client_secret,
                    v_record.access_token,
                    v_record.refresh_token,
                    v_record.token_expires_at,
                    v_record.last_sync_at,
                    v_record.sync_status,
                    v_record.error_message,
                    v_record.active,
                    v_record.created_at,
                    v_record.updated_at
                )
                ON CONFLICT (store_id) DO UPDATE SET
                    sistema_erp = EXCLUDED.sistema_erp,
                    client_id = EXCLUDED.client_id,
                    client_secret = EXCLUDED.client_secret,
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    token_expires_at = EXCLUDED.token_expires_at,
                    last_sync_at = EXCLUDED.last_sync_at,
                    sync_status = EXCLUDED.sync_status,
                    error_message = EXCLUDED.error_message,
                    active = EXCLUDED.active,
                    updated_at = NOW();
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Dados migrados de tiny_api_credentials para erp_integrations';
    END IF;
END;
$$;

-- =============================================================================
-- 3. RLS (Row Level Security)
-- =============================================================================
ALTER TABLE erp_integrations ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
CREATE POLICY "admin_erp_integrations_all" ON erp_integrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- LOJA vê apenas suas próprias integrações
CREATE POLICY "loja_erp_integrations_own" ON erp_integrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.store_default = erp_integrations.store_id::text
        )
    );

-- =============================================================================
-- 4. TRIGGER para atualizar updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_erp_integrations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_erp_integrations_updated_at
    BEFORE UPDATE ON erp_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_erp_integrations_updated_at();

-- =============================================================================
-- 5. FUNÇÃO: Buscar integração ERP de uma loja
-- =============================================================================
CREATE OR REPLACE FUNCTION get_erp_integration(
    p_store_id UUID
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    sistema_erp TEXT,
    client_id TEXT,
    client_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    sync_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ei.id,
        ei.store_id,
        ei.sistema_erp,
        ei.client_id,
        ei.client_secret,
        ei.access_token,
        ei.refresh_token,
        ei.token_expires_at,
        ei.sync_status
    FROM erp_integrations ei
    WHERE ei.store_id = p_store_id
        AND ei.active = true;
END;
$$;

COMMENT ON FUNCTION get_erp_integration(UUID) IS 'Retorna integração ERP de uma loja (cada loja tem apenas uma)';

-- =============================================================================
-- 6. VALIDAR QUE sistema_erp DA INTEGRAÇÃO BATE COM O DA LOJA
-- =============================================================================
-- Garantir que quando uma integração é criada, o sistema_erp bate com o da loja
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_erp_integration_sistema_match'
    ) THEN
        ALTER TABLE erp_integrations
        ADD CONSTRAINT check_erp_integration_sistema_match
        CHECK (
            EXISTS (
                SELECT 1 FROM stores
                WHERE stores.id = erp_integrations.store_id
                AND (
                    stores.sistema_erp = erp_integrations.sistema_erp
                    OR stores.sistema_erp IS NULL
                )
            )
        );
    END IF;
END $$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

