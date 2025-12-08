-- ============================================================================
-- CRIAR TABELAS WHATSAPP COMPLETAS - Schema: sistemaretiradas
-- Data: 2024-12-07
-- Descricao: Tabelas para credenciais e configuracao de notificacoes WhatsApp
-- ============================================================================

-- ============================================================================
-- 1. TABELA: whatsapp_credentials
-- Armazena credenciais do uzapi/n8n para cada loja
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificacao
    customer_id VARCHAR(255) NOT NULL,
    site_slug VARCHAR(100) NOT NULL,
    
    -- Credenciais UZAPI
    uzapi_instance_id VARCHAR(255),
    uzapi_token VARCHAR(500),
    
    -- Relacionamentos
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'pending')),
    CONSTRAINT unique_customer_site UNIQUE (customer_id, site_slug)
);

-- Comentarios
COMMENT ON TABLE sistemaretiradas.whatsapp_credentials IS 'Credenciais UZAPI/N8N para envio de WhatsApp por loja';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.customer_id IS 'ID do cliente no N8N (geralmente email)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.site_slug IS 'Slug da loja para identificacao';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uzapi_instance_id IS 'ID da instancia UZAPI';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uzapi_token IS 'Token de autenticacao UZAPI';

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_customer_site 
    ON sistemaretiradas.whatsapp_credentials(customer_id, site_slug);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_store 
    ON sistemaretiradas.whatsapp_credentials(store_id);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_status 
    ON sistemaretiradas.whatsapp_credentials(status);

-- ============================================================================
-- 2. TABELA: whatsapp_notification_config
-- Armazena numeros para receber notificacoes por tipo
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamentos
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    
    -- Configuracao
    phone VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'VENDA',
    is_active BOOLEAN DEFAULT true,
    description VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_notification_type CHECK (
        notification_type IN ('VENDA', 'PARABENS', 'ADIANTAMENTO', 'CASHBACK', 'META', 'GERAL')
    )
);

-- Comentarios
COMMENT ON TABLE sistemaretiradas.whatsapp_notification_config IS 'Configuracao de destinatarios para notificacoes WhatsApp';
COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.phone IS 'Numero no formato 55 + DDD + numero';
COMMENT ON COLUMN sistemaretiradas.whatsapp_notification_config.notification_type IS 'Tipo: VENDA, PARABENS, ADIANTAMENTO, CASHBACK, META, GERAL';

-- Indices
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_store 
    ON sistemaretiradas.whatsapp_notification_config(store_id);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_admin 
    ON sistemaretiradas.whatsapp_notification_config(admin_id);
    
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_config_type_active 
    ON sistemaretiradas.whatsapp_notification_config(notification_type, is_active);

-- ============================================================================
-- 3. RLS (Row Level Security)
-- ============================================================================
ALTER TABLE sistemaretiradas.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.whatsapp_notification_config ENABLE ROW LEVEL SECURITY;

-- Politicas para whatsapp_credentials
DROP POLICY IF EXISTS "Admins podem gerenciar credenciais da sua loja" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "Admins podem gerenciar credenciais da sua loja"
    ON sistemaretiradas.whatsapp_credentials
    FOR ALL
    USING (
        admin_id = auth.uid() 
        OR store_id IN (
            SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access credentials" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "Service role full access credentials"
    ON sistemaretiradas.whatsapp_credentials
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Politicas para whatsapp_notification_config
DROP POLICY IF EXISTS "Admins podem gerenciar notificacoes da sua loja" ON sistemaretiradas.whatsapp_notification_config;
CREATE POLICY "Admins podem gerenciar notificacoes da sua loja"
    ON sistemaretiradas.whatsapp_notification_config
    FOR ALL
    USING (
        admin_id = auth.uid() 
        OR store_id IN (
            SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access notifications" ON sistemaretiradas.whatsapp_notification_config;
CREATE POLICY "Service role full access notifications"
    ON sistemaretiradas.whatsapp_notification_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 4. VERIFICACAO
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_credentials'
    ) THEN
        RAISE NOTICE 'Tabela whatsapp_credentials criada com sucesso!';
    ELSE
        RAISE WARNING 'ERRO: Tabela whatsapp_credentials NAO foi criada!';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_notification_config'
    ) THEN
        RAISE NOTICE 'Tabela whatsapp_notification_config criada com sucesso!';
    ELSE
        RAISE WARNING 'ERRO: Tabela whatsapp_notification_config NAO foi criada!';
    END IF;
END $$;

-- ============================================================================
-- 5. QUERY CORRETA PARA N8N (copie esta query para o N8N)
-- ============================================================================
-- A query que deve ser usada no N8N e:
/*
SELECT 
    customer_id,
    site_slug,
    uzapi_instance_id,
    uzapi_token
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 AND site_slug = $2 AND status = 'active'
LIMIT 1
*/

SELECT 'Tabelas WhatsApp criadas com sucesso! Atualize o N8N para usar schema sistemaretiradas.' AS status;
