-- =====================================================
-- CRIAR TABELA payment_gateways
-- =====================================================
-- Tabela para armazenar configurações de gateways de pagamento
-- Acessível apenas pelo dono do sistema (dev)

CREATE TABLE IF NOT EXISTS sistemaretiradas.payment_gateways (
    id TEXT PRIMARY KEY, -- STRIPE, MERCADO_PAGO, CAKTO, etc
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    webhook_url TEXT NOT NULL,
    api_key TEXT, -- Public key / API key
    api_secret TEXT, -- Private key / API secret (criptografado)
    webhook_secret TEXT, -- Secret para validar assinatura do webhook
    metadata JSONB, -- Metadados adicionais específicos do gateway
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON sistemaretiradas.payment_gateways(is_active) WHERE is_active = true;

COMMENT ON TABLE sistemaretiradas.payment_gateways IS 'Configurações globais de gateways de pagamento (apenas dono do sistema)';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.id IS 'ID do gateway (STRIPE, MERCADO_PAGO, CAKTO, etc)';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.is_active IS 'Se o gateway está ativo e processando webhooks';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.webhook_url IS 'URL do webhook configurada no gateway';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.api_key IS 'API Key / Public Key do gateway';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.api_secret IS 'API Secret / Private Key (armazenar criptografado)';
COMMENT ON COLUMN sistemaretiradas.payment_gateways.webhook_secret IS 'Secret para validar assinatura dos webhooks recebidos';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_payment_gateways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_gateways_updated_at ON sistemaretiradas.payment_gateways;
CREATE TRIGGER trigger_update_payment_gateways_updated_at
    BEFORE UPDATE ON sistemaretiradas.payment_gateways
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_payment_gateways_updated_at();

-- RLS: Apenas Super Admin ou service_role pode acessar
ALTER TABLE sistemaretiradas.payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev can manage payment gateways" ON sistemaretiradas.payment_gateways;
CREATE POLICY "Dev can manage payment gateways" ON sistemaretiradas.payment_gateways
    FOR ALL USING (
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND is_super_admin = TRUE
        )
    );

-- Inserir gateways padrão
INSERT INTO sistemaretiradas.payment_gateways (id, name, display_name, is_active, webhook_url)
VALUES
    ('STRIPE', 'STRIPE', 'Stripe', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=STRIPE'),
    ('MERCADO_PAGO', 'MERCADO_PAGO', 'Mercado Pago', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=MERCADO_PAGO'),
    ('PAGSEGURO', 'PAGSEGURO', 'PagSeguro', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=PAGSEGURO'),
    ('ASAAS', 'ASAAS', 'Asaas', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=ASAAS'),
    ('CAKTO', 'CAKTO', 'CAKTO', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO'),
    ('CUSTOM', 'CUSTOM', 'Custom', false, 'https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CUSTOM')
ON CONFLICT (id) DO NOTHING;

