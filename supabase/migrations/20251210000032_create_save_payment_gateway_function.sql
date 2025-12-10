-- =====================================================
-- FUNÇÃO RPC: Salvar configuração de gateway
-- =====================================================
-- Permite salvar configurações de gateway via RPC
-- Acesso restrito (apenas dev ou service_role)

CREATE OR REPLACE FUNCTION sistemaretiradas.save_payment_gateway(
    p_id TEXT,
    p_name TEXT,
    p_display_name TEXT,
    p_is_active BOOLEAN,
    p_webhook_url TEXT,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_secret TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- Verificar se é Super Admin (via profiles para evitar erro de permissão)
    -- Ou permitir apenas service_role
    IF auth.role() != 'service_role' THEN
        -- Verificar se é Super Admin
        IF NOT EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND is_super_admin = TRUE
        ) THEN
            RAISE EXCEPTION 'Acesso negado. Apenas Super Admin autorizado.';
        END IF;
    END IF;

    -- Upsert gateway
    INSERT INTO sistemaretiradas.payment_gateways (
        id,
        name,
        display_name,
        is_active,
        webhook_url,
        api_key,
        api_secret,
        webhook_secret,
        metadata,
        updated_at
    ) VALUES (
        p_id,
        p_name,
        p_display_name,
        p_is_active,
        p_webhook_url,
        p_api_key,
        p_api_secret,
        p_webhook_secret,
        p_metadata,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        display_name = EXCLUDED.display_name,
        is_active = EXCLUDED.is_active,
        webhook_url = EXCLUDED.webhook_url,
        api_key = EXCLUDED.api_key,
        api_secret = EXCLUDED.api_secret,
        webhook_secret = EXCLUDED.webhook_secret,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'message', 'Gateway salvo com sucesso'
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.save_payment_gateway IS 'Salva configuração de gateway de pagamento (apenas dev ou service_role)';

GRANT EXECUTE ON FUNCTION sistemaretiradas.save_payment_gateway TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.save_payment_gateway TO service_role;

