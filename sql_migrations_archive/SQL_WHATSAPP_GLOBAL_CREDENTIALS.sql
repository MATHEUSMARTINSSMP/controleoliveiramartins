-- ============================================================================
-- CREDENCIAIS WHATSAPP GLOBAIS - Numero Remetente Elevea
-- Data: 2024-12-08
-- Descricao: Adiciona suporte a numero WhatsApp global que fica disponivel
--            para todas as lojas que usarem sender_type = 'GLOBAL'
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNA is_global NA TABELA whatsapp_credentials
-- ============================================================================

-- Flag para indicar se e a credencial global (numero Elevea)
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Nome de exibicao para a instancia
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Numero de telefone conectado (para exibicao)
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS uazapi_phone_number VARCHAR(20);

-- QR Code para conexao
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS uazapi_qr_code TEXT;

-- Status da conexao UZAPI
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS uazapi_status VARCHAR(50);

-- Nome da instancia WhatsApp
ALTER TABLE sistemaretiradas.whatsapp_credentials
ADD COLUMN IF NOT EXISTS whatsapp_instance_name VARCHAR(100);

-- Comentarios
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.is_global IS 'Se true, e o numero global Elevea disponivel para todas as lojas';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.display_name IS 'Nome de exibicao da instancia (ex: Elevea Principal)';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_phone_number IS 'Numero de telefone conectado';
COMMENT ON COLUMN sistemaretiradas.whatsapp_credentials.uazapi_status IS 'Status da conexao: connected, disconnected, qr_required, etc';

-- ============================================================================
-- 2. CRIAR INDICE PARA BUSCA RAPIDA DA CREDENCIAL GLOBAL
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_global 
    ON sistemaretiradas.whatsapp_credentials(is_global) 
    WHERE is_global = true;

-- ============================================================================
-- 3. CONSTRAINT PARA GARANTIR APENAS UMA CREDENCIAL GLOBAL ATIVA
-- ============================================================================

-- Primeiro, remover constraint se existir
ALTER TABLE sistemaretiradas.whatsapp_credentials
DROP CONSTRAINT IF EXISTS unique_global_credential;

-- Criar partial unique index para garantir apenas uma credencial global
CREATE UNIQUE INDEX IF NOT EXISTS unique_global_credential
    ON sistemaretiradas.whatsapp_credentials (is_global)
    WHERE is_global = true AND status = 'active';

-- ============================================================================
-- 4. FUNCAO RPC PARA BUSCAR CREDENCIAL GLOBAL
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_global_whatsapp_credential()
RETURNS TABLE (
    id UUID,
    customer_id VARCHAR,
    site_slug VARCHAR,
    display_name VARCHAR,
    uazapi_instance_id VARCHAR,
    uazapi_token VARCHAR,
    uazapi_phone_number VARCHAR,
    uazapi_status VARCHAR,
    uazapi_qr_code TEXT,
    status VARCHAR,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.id,
        wc.customer_id,
        wc.site_slug,
        wc.display_name,
        wc.uzapi_instance_id,
        wc.uzapi_token,
        wc.uazapi_phone_number,
        wc.uazapi_status,
        wc.uazapi_qr_code,
        wc.status,
        wc.updated_at
    FROM sistemaretiradas.whatsapp_credentials wc
    WHERE wc.is_global = true
    AND wc.status = 'active'
    LIMIT 1;
END;
$$;

-- ============================================================================
-- 5. FUNCAO RPC PARA CRIAR/ATUALIZAR CREDENCIAL GLOBAL
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.upsert_global_whatsapp_credential(
    p_customer_id VARCHAR,
    p_site_slug VARCHAR,
    p_display_name VARCHAR DEFAULT 'Elevea Global',
    p_uazapi_instance_id VARCHAR DEFAULT NULL,
    p_uazapi_token VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credential_id UUID;
BEGIN
    -- Verificar se ja existe credencial global
    SELECT id INTO v_credential_id
    FROM sistemaretiradas.whatsapp_credentials
    WHERE is_global = true
    LIMIT 1;
    
    IF v_credential_id IS NOT NULL THEN
        -- Atualizar existente
        UPDATE sistemaretiradas.whatsapp_credentials
        SET 
            customer_id = p_customer_id,
            site_slug = p_site_slug,
            display_name = p_display_name,
            uzapi_instance_id = COALESCE(p_uazapi_instance_id, uzapi_instance_id),
            uzapi_token = COALESCE(p_uazapi_token, uzapi_token),
            updated_at = NOW()
        WHERE id = v_credential_id;
    ELSE
        -- Criar nova
        INSERT INTO sistemaretiradas.whatsapp_credentials (
            customer_id,
            site_slug,
            display_name,
            is_global,
            uzapi_instance_id,
            uzapi_token,
            status
        ) VALUES (
            p_customer_id,
            p_site_slug,
            p_display_name,
            true,
            p_uazapi_instance_id,
            p_uazapi_token,
            'active'
        )
        RETURNING id INTO v_credential_id;
    END IF;
    
    RETURN v_credential_id;
END;
$$;

-- ============================================================================
-- 6. FUNCAO RPC PARA ATUALIZAR STATUS DA CREDENCIAL GLOBAL
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.update_global_whatsapp_status(
    p_status VARCHAR,
    p_phone_number VARCHAR DEFAULT NULL,
    p_qr_code TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sistemaretiradas.whatsapp_credentials
    SET 
        uazapi_status = p_status,
        uazapi_phone_number = COALESCE(p_phone_number, uazapi_phone_number),
        uazapi_qr_code = p_qr_code,
        updated_at = NOW()
    WHERE is_global = true;
END;
$$;

-- ============================================================================
-- 7. RLS POLICY PARA CREDENCIAL GLOBAL (somente leitura para admins)
-- ============================================================================

-- Admins podem VER a credencial global (mas nao editar)
DROP POLICY IF EXISTS "Admins podem ver credencial global" ON sistemaretiradas.whatsapp_credentials;
CREATE POLICY "Admins podem ver credencial global"
    ON sistemaretiradas.whatsapp_credentials
    FOR SELECT
    USING (
        is_global = true
        OR admin_id = auth.uid() 
        OR store_id IN (
            SELECT id FROM sistemaretiradas.stores WHERE admin_id = auth.uid()
        )
    );

-- ============================================================================
-- 8. INSERIR CREDENCIAL GLOBAL PADRAO (SE NAO EXISTIR)
-- ============================================================================

INSERT INTO sistemaretiradas.whatsapp_credentials (
    customer_id,
    site_slug,
    display_name,
    is_global,
    status
) VALUES (
    'elevea@eleveaagencia.com.br',
    'elevea_global',
    'Elevea Global',
    true,
    'active'
)
ON CONFLICT DO NOTHING;
