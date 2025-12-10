-- =====================================================
-- SISTEMA DE BILLING GENÉRICO E MULTI-GATEWAY
-- =====================================================
-- Sistema flexível de billing que suporta múltiplos
-- gateways de pagamento (Stripe, Mercado Pago, PagSeguro, etc)
-- Verificação automática de status e desativação de acesso

-- =====================================================
-- 1. ADICIONAR CAMPOS DE BILLING NA TABELA admin_subscriptions
-- =====================================================
ALTER TABLE sistemaretiradas.admin_subscriptions
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'MANUAL' CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM')),
ADD COLUMN IF NOT EXISTS external_customer_id TEXT, -- ID do cliente no gateway externo
ADD COLUMN IF NOT EXISTS external_subscription_id TEXT, -- ID da subscription no gateway externo
ADD COLUMN IF NOT EXISTS external_price_id TEXT, -- ID do preço/plano no gateway externo
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('PAID', 'UNPAID', 'PAST_DUE', 'CANCELED', 'TRIAL', 'PENDING')),
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_name TEXT,
ADD COLUMN IF NOT EXISTS billing_document TEXT, -- CPF/CNPJ
ADD COLUMN IF NOT EXISTS gateway_metadata JSONB, -- Metadados específicos do gateway

-- Constraints para garantir unicidade por gateway
-- Nota: ADD CONSTRAINT IF NOT EXISTS não é suportado, então verificamos antes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admin_subscriptions_external_unique'
    AND conrelid = 'sistemaretiradas.admin_subscriptions'::regclass
  ) THEN
    ALTER TABLE sistemaretiradas.admin_subscriptions
    ADD CONSTRAINT admin_subscriptions_external_unique 
    UNIQUE (payment_gateway, external_subscription_id) 
    WHERE external_subscription_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_payment_gateway ON sistemaretiradas.admin_subscriptions(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_external_customer ON sistemaretiradas.admin_subscriptions(external_customer_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_external_subscription ON sistemaretiradas.admin_subscriptions(external_subscription_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_payment_status ON sistemaretiradas.admin_subscriptions(payment_status);

COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_gateway IS 'Gateway de pagamento: MANUAL, STRIPE, MERCADO_PAGO, PAGSEGURO, ASAAS, CUSTOM';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.external_customer_id IS 'ID do cliente no gateway externo';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.external_subscription_id IS 'ID da subscription no gateway externo';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.payment_status IS 'Status do pagamento: PAID, UNPAID, PAST_DUE, CANCELED, TRIAL, PENDING';
COMMENT ON COLUMN sistemaretiradas.admin_subscriptions.gateway_metadata IS 'Metadados específicos do gateway (armazena dados customizados)';

-- =====================================================
-- 2. TABELA: payment_history (Histórico de pagamentos)
-- =====================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES sistemaretiradas.admin_subscriptions(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE,
    payment_gateway TEXT NOT NULL DEFAULT 'MANUAL' CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM')),
    external_payment_id TEXT, -- ID do pagamento no gateway externo (pode ser invoice, transaction, etc)
    external_transaction_id TEXT, -- ID da transação no gateway
    amount INTEGER NOT NULL, -- Em centavos
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELED')),
    payment_method TEXT, -- card, pix, boleto, credit_card, debit_card, etc
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    description TEXT,
    gateway_response JSONB, -- Resposta completa do gateway
    metadata JSONB, -- Metadados customizados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint para garantir unicidade por gateway
    CONSTRAINT payment_history_external_unique UNIQUE (payment_gateway, external_payment_id) WHERE external_payment_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON sistemaretiradas.payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_admin ON sistemaretiradas.payment_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON sistemaretiradas.payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_gateway ON sistemaretiradas.payment_history(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_payment_history_external_payment ON sistemaretiradas.payment_history(external_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_external_transaction ON sistemaretiradas.payment_history(external_transaction_id);

COMMENT ON TABLE sistemaretiradas.payment_history IS 'Histórico completo de todos os pagamentos realizados (suporta múltiplos gateways)';
COMMENT ON COLUMN sistemaretiradas.payment_history.payment_gateway IS 'Gateway usado para o pagamento';
COMMENT ON COLUMN sistemaretiradas.payment_history.external_payment_id IS 'ID do pagamento no gateway externo (invoice_id, payment_id, etc)';
COMMENT ON COLUMN sistemaretiradas.payment_history.gateway_response IS 'Resposta completa do gateway (armazena dados originais)';

-- =====================================================
-- 3. TABELA: billing_events (Log de eventos dos gateways)
-- =====================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_gateway TEXT NOT NULL DEFAULT 'MANUAL' CHECK (payment_gateway IN ('MANUAL', 'STRIPE', 'MERCADO_PAGO', 'PAGSEGURO', 'ASAAS', 'CUSTOM')),
    external_event_id TEXT NOT NULL, -- ID do evento no gateway externo
    event_type TEXT NOT NULL,
    subscription_id UUID REFERENCES sistemaretiradas.admin_subscriptions(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint para garantir unicidade por gateway
    CONSTRAINT billing_events_external_unique UNIQUE (payment_gateway, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_events_payment_gateway ON sistemaretiradas.billing_events(payment_gateway);
CREATE INDEX IF NOT EXISTS idx_billing_events_external_event ON sistemaretiradas.billing_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON sistemaretiradas.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_processed ON sistemaretiradas.billing_events(processed);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription ON sistemaretiradas.billing_events(subscription_id);

COMMENT ON TABLE sistemaretiradas.billing_events IS 'Log de todos os eventos recebidos dos gateways de pagamento (multi-gateway)';
COMMENT ON COLUMN sistemaretiradas.billing_events.payment_gateway IS 'Gateway que enviou o evento';
COMMENT ON COLUMN sistemaretiradas.billing_events.external_event_id IS 'ID do evento no gateway externo';

-- =====================================================
-- 4. FUNÇÃO: Verificar se admin tem acesso ativo (com suspensão gradual)
-- =====================================================
-- NOTA: Esta função foi substituída pela versão em 20251210000037_create_billing_auto_check.sql
-- Mantida apenas para compatibilidade, mas será sobrescrita pela migração 37
-- A versão nova retorna TABLE em vez de JSON
CREATE OR REPLACE FUNCTION sistemaretiradas.check_admin_access(p_admin_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_subscription sistemaretiradas.admin_subscriptions;
    v_result JSON;
    v_has_access BOOLEAN := false;
    v_access_level TEXT := 'FULL'; -- FULL, WARNING, READ_ONLY, BLOCKED
    v_reason TEXT;
    v_days_overdue INTEGER := 0;
    v_message TEXT;
BEGIN
    -- Buscar subscription ativa
    SELECT * INTO v_subscription
    FROM sistemaretiradas.admin_subscriptions
    WHERE admin_id = p_admin_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Se não tem subscription, sem acesso
    IF v_subscription IS NULL THEN
        v_result := json_build_object(
            'has_access', false,
            'access_level', 'BLOCKED',
            'reason', 'NO_SUBSCRIPTION',
            'message', 'Nenhuma assinatura encontrada',
            'days_overdue', 0
        );
        RETURN v_result;
    END IF;
    
    -- Verificar status cancelado
    IF v_subscription.status = 'CANCELLED' THEN
        v_result := json_build_object(
            'has_access', false,
            'access_level', 'BLOCKED',
            'reason', 'CANCELLED',
            'message', 'Assinatura cancelada',
            'canceled_at', v_subscription.canceled_at,
            'days_overdue', 0
        );
        RETURN v_result;
    END IF;
    
    -- Se está pago e ativo, acesso completo
    IF v_subscription.payment_status = 'PAID' AND v_subscription.status = 'ACTIVE' THEN
        -- Verificar se não está expirado
        IF v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > NOW() THEN
            v_result := json_build_object(
                'has_access', true,
                'access_level', 'FULL',
                'reason', 'ACTIVE',
                'message', 'Acesso ativo',
                'status', v_subscription.status,
                'payment_status', v_subscription.payment_status,
                'current_period_end', v_subscription.current_period_end,
                'next_payment_date', v_subscription.next_payment_date,
                'days_overdue', 0
            );
            RETURN v_result;
        END IF;
    END IF;
    
    -- Calcular dias de atraso
    IF v_subscription.current_period_end IS NOT NULL THEN
        v_days_overdue := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_subscription.current_period_end))::INTEGER);
    END IF;
    
    -- Sistema de suspensão gradual:
    -- - 0-1 dias: Acesso completo (grace period)
    -- - 2 dias: Aviso visual (WARNING)
    -- - 3-6 dias: Modo somente leitura (READ_ONLY)
    -- - 7+ dias: Bloqueado (BLOCKED)
    
    IF v_days_overdue >= 7 THEN
        v_access_level := 'BLOCKED';
        v_has_access := false;
        v_reason := 'PAYMENT_OVERDUE_7_DAYS';
        v_message := 'Acesso bloqueado devido a atraso de 7+ dias no pagamento';
    ELSIF v_days_overdue >= 3 THEN
        v_access_level := 'READ_ONLY';
        v_has_access := true; -- Ainda tem acesso, mas somente leitura
        v_reason := 'PAYMENT_OVERDUE_3_DAYS';
        v_message := 'Acesso em modo somente leitura (3+ dias de atraso). Não é possível criar ou editar registros.';
    ELSIF v_days_overdue >= 2 THEN
        v_access_level := 'WARNING';
        v_has_access := true;
        v_reason := 'PAYMENT_OVERDUE_2_DAYS';
        v_message := 'Aviso: Pagamento em atraso há ' || v_days_overdue || ' dia(s)';
    ELSE
        -- 0-1 dias: ainda permite acesso completo (grace period)
        v_access_level := 'FULL';
        v_has_access := true;
        v_reason := 'ACTIVE_GRACE_PERIOD';
        v_message := 'Acesso ativo (período de tolerância)';
    END IF;
    
    -- Construir resultado
    v_result := json_build_object(
        'has_access', v_has_access,
        'access_level', v_access_level,
        'reason', v_reason,
        'message', v_message,
        'days_overdue', v_days_overdue,
        'status', v_subscription.status,
        'payment_status', v_subscription.payment_status,
        'current_period_end', v_subscription.current_period_end,
        'next_payment_date', v_subscription.next_payment_date,
        'last_payment_date', v_subscription.last_payment_date
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.check_admin_access IS 'Verifica acesso do admin com suspensão gradual: FULL (0-1 dias), WARNING (2 dias), READ_ONLY (3-6 dias), BLOCKED (7+ dias)';

-- =====================================================
-- 5. FUNÇÃO: Atualizar status de subscription baseado em gateway externo
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.update_subscription_from_gateway(
    p_payment_gateway TEXT,
    p_external_subscription_id TEXT,
    p_gateway_data JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_subscription sistemaretiradas.admin_subscriptions;
    v_status TEXT;
    v_payment_status TEXT;
    v_period_start TIMESTAMP WITH TIME ZONE;
    v_period_end TIMESTAMP WITH TIME ZONE;
    v_cancel_at_period_end BOOLEAN;
    v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Buscar subscription
    SELECT * INTO v_subscription
    FROM sistemaretiradas.admin_subscriptions
    WHERE payment_gateway = p_payment_gateway
      AND external_subscription_id = p_external_subscription_id;
    
    IF v_subscription IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Subscription not found');
    END IF;
    
    -- Extrair dados do gateway (estrutura genérica)
    -- Cada gateway pode ter estruturas diferentes, mas tentamos mapear campos comuns
    v_status := COALESCE(
        p_gateway_data->>'status',
        p_gateway_data->>'subscription_status',
        v_subscription.status
    );
    
    -- Normalizar status
    v_status := CASE UPPER(v_status)
        WHEN 'ACTIVE' THEN 'ACTIVE'
        WHEN 'TRIAL' THEN 'TRIAL'
        WHEN 'TRIALING' THEN 'TRIAL'
        WHEN 'PAST_DUE' THEN 'SUSPENDED'
        WHEN 'CANCELED' THEN 'CANCELLED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'UNPAID' THEN 'SUSPENDED'
        WHEN 'SUSPENDED' THEN 'SUSPENDED'
        ELSE v_subscription.status
    END;
    
    -- Mapear payment_status baseado no status
    v_payment_status := CASE v_status
        WHEN 'ACTIVE' THEN 'PAID'
        WHEN 'TRIAL' THEN 'TRIAL'
        WHEN 'SUSPENDED' THEN CASE 
            WHEN v_subscription.payment_status = 'PAST_DUE' THEN 'PAST_DUE'
            ELSE 'UNPAID'
        END
        WHEN 'CANCELLED' THEN 'CANCELED'
        ELSE 'UNPAID'
    END;
    
    -- Extrair datas (suporta timestamp Unix ou ISO string)
    IF p_gateway_data->'current_period_start' IS NOT NULL THEN
        IF (p_gateway_data->>'current_period_start')::text ~ '^\d+$' THEN
            v_period_start := to_timestamp((p_gateway_data->>'current_period_start')::bigint);
        ELSE
            v_period_start := (p_gateway_data->>'current_period_start')::timestamp with time zone;
        END IF;
    END IF;
    
    IF p_gateway_data->'current_period_end' IS NOT NULL THEN
        IF (p_gateway_data->>'current_period_end')::text ~ '^\d+$' THEN
            v_period_end := to_timestamp((p_gateway_data->>'current_period_end')::bigint);
        ELSE
            v_period_end := (p_gateway_data->>'current_period_end')::timestamp with time zone;
        END IF;
    END IF;
    
    IF p_gateway_data->'cancel_at_period_end' IS NOT NULL THEN
        v_cancel_at_period_end := (p_gateway_data->>'cancel_at_period_end')::boolean;
    END IF;
    
    IF p_gateway_data->'trial_end' IS NOT NULL THEN
        IF (p_gateway_data->>'trial_end')::text ~ '^\d+$' THEN
            v_trial_end := to_timestamp((p_gateway_data->>'trial_end')::bigint);
        ELSE
            v_trial_end := (p_gateway_data->>'trial_end')::timestamp with time zone;
        END IF;
    END IF;
    
    -- Atualizar subscription
    UPDATE sistemaretiradas.admin_subscriptions
    SET 
        status = v_status,
        payment_status = v_payment_status,
        current_period_start = COALESCE(v_period_start, current_period_start),
        current_period_end = COALESCE(v_period_end, current_period_end),
        cancel_at_period_end = COALESCE(v_cancel_at_period_end, cancel_at_period_end),
        trial_end = COALESCE(v_trial_end, trial_end),
        gateway_metadata = COALESCE(p_gateway_data, gateway_metadata),
        updated_at = NOW()
    WHERE id = v_subscription.id;
    
    RETURN json_build_object(
        'success', true,
        'subscription_id', v_subscription.id,
        'admin_id', v_subscription.admin_id
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.update_subscription_from_gateway IS 'Atualiza subscription baseado em dados de qualquer gateway de pagamento (genérico)';

-- =====================================================
-- 6. FUNÇÃO: Registrar pagamento no histórico (genérico)
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.record_payment(
    p_subscription_id UUID,
    p_payment_gateway TEXT DEFAULT 'MANUAL',
    p_external_payment_id TEXT DEFAULT NULL,
    p_external_transaction_id TEXT DEFAULT NULL,
    p_amount INTEGER,
    p_status TEXT,
    p_payment_method TEXT DEFAULT NULL,
    p_period_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_gateway_response JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_subscription sistemaretiradas.admin_subscriptions;
    v_payment_id UUID;
BEGIN
    -- Buscar subscription
    SELECT * INTO v_subscription
    FROM sistemaretiradas.admin_subscriptions
    WHERE id = p_subscription_id;
    
    IF v_subscription IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Subscription not found');
    END IF;
    
    -- Inserir pagamento
    INSERT INTO sistemaretiradas.payment_history (
        subscription_id,
        admin_id,
        payment_gateway,
        external_payment_id,
        external_transaction_id,
        amount,
        status,
        payment_method,
        period_start,
        period_end,
        gateway_response,
        metadata
    ) VALUES (
        p_subscription_id,
        v_subscription.admin_id,
        p_payment_gateway,
        p_external_payment_id,
        p_external_transaction_id,
        p_amount,
        p_status,
        p_payment_method,
        p_period_start,
        p_period_end,
        p_gateway_response,
        p_metadata
    )
    ON CONFLICT (payment_gateway, external_payment_id) 
    WHERE external_payment_id IS NOT NULL
    DO UPDATE SET
        status = EXCLUDED.status,
        payment_date = CASE WHEN EXCLUDED.status = 'SUCCEEDED' THEN NOW() ELSE payment_history.payment_date END,
        gateway_response = EXCLUDED.gateway_response
    RETURNING id INTO v_payment_id;
    
    -- Se pagamento bem-sucedido, atualizar subscription E reativar admin
    IF p_status = 'SUCCEEDED' THEN
        UPDATE sistemaretiradas.admin_subscriptions
        SET 
            payment_status = 'PAID',
            last_payment_date = NOW(),
            status = 'ACTIVE',
            current_period_start = COALESCE(p_period_start, current_period_start),
            current_period_end = COALESCE(p_period_end, current_period_end),
            next_payment_date = p_period_end,
            updated_at = NOW()
        WHERE id = p_subscription_id;
        
        -- REATIVAR ADMIN IMEDIATAMENTE quando pagamento é bem-sucedido
        UPDATE sistemaretiradas.profiles
        SET is_active = TRUE
        WHERE id = v_subscription.admin_id AND role = 'ADMIN';
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'payment_id', v_payment_id
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.record_payment IS 'Registra um pagamento no histórico (suporta múltiplos gateways)';

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================
ALTER TABLE sistemaretiradas.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view own payment history" ON sistemaretiradas.payment_history;
CREATE POLICY "Admin can view own payment history" ON sistemaretiradas.payment_history
    FOR SELECT USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage payment history" ON sistemaretiradas.payment_history;
CREATE POLICY "Service role can manage payment history" ON sistemaretiradas.payment_history
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage billing events" ON sistemaretiradas.billing_events;
CREATE POLICY "Service role can manage billing events" ON sistemaretiradas.billing_events
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================
-- =====================================================
-- 9. FUNÇÃO: Registrar pagamento manual
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.record_manual_payment(
    p_admin_id UUID,
    p_amount INTEGER,
    p_payment_method TEXT,
    p_payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_period_end TIMESTAMP WITH TIME ZONE,
    p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription sistemaretiradas.admin_subscriptions;
    v_payment_id UUID;
BEGIN
    -- Buscar subscription ativa do admin
    SELECT * INTO v_subscription
    FROM sistemaretiradas.admin_subscriptions
    WHERE admin_id = p_admin_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_subscription IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Subscription not found');
    END IF;
    
    -- Registrar pagamento manual
    INSERT INTO sistemaretiradas.payment_history (
        subscription_id,
        admin_id,
        payment_gateway,
        amount,
        status,
        payment_method,
        payment_date,
        period_start,
        period_end,
        description
    ) VALUES (
        v_subscription.id,
        p_admin_id,
        'MANUAL',
        p_amount,
        'SUCCEEDED',
        p_payment_method,
        p_payment_date,
        p_period_start,
        p_period_end,
        p_description
    )
    RETURNING id INTO v_payment_id;
    
    -- Atualizar subscription E reativar admin
    UPDATE sistemaretiradas.admin_subscriptions
    SET 
        payment_status = 'PAID',
        last_payment_date = p_payment_date,
        status = 'ACTIVE',
        current_period_start = p_period_start,
        current_period_end = p_period_end,
        next_payment_date = p_period_end,
        updated_at = NOW()
    WHERE id = v_subscription.id;
    
    -- REATIVAR ADMIN IMEDIATAMENTE quando pagamento manual é registrado
    UPDATE sistemaretiradas.profiles
    SET is_active = TRUE
    WHERE id = p_admin_id AND role = 'ADMIN';
    
    RETURN json_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'subscription_id', v_subscription.id
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.record_manual_payment IS 'Registra um pagamento manual (sem gateway)';

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_admin_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.check_admin_access(UUID) TO anon;
GRANT EXECUTE ON FUNCTION sistemaretiradas.update_subscription_from_gateway(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.record_payment(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.record_manual_payment(UUID, INTEGER, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;

