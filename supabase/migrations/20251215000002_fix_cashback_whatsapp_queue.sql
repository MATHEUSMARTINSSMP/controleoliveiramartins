-- ============================================================================
-- FIX: Criar sistema de fila WhatsApp para Cashback
-- Data: 2025-12-15
-- ============================================================================

-- ============================================================================
-- PARTE 1: CRIAR TABELA DE FILA
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES sistemaretiradas.cashback_transactions(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL,
    cliente_nome TEXT,
    cliente_telefone TEXT,
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    valor_cashback NUMERIC(10,2),
    saldo_total NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_status 
ON sistemaretiradas.cashback_whatsapp_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_store 
ON sistemaretiradas.cashback_whatsapp_queue(store_id);

-- ============================================================================
-- PARTE 2: FUNÇÃO ENQUEUE (Versão Corrigida)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_cliente_id UUID,
    p_cliente_nome TEXT,
    p_cliente_telefone TEXT,
    p_valor_cashback NUMERIC,
    p_saldo_total NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se não tem telefone, não enfileirar
    IF p_cliente_telefone IS NULL OR p_cliente_telefone = '' THEN
        RAISE NOTICE 'Cliente sem telefone, WhatsApp não enfileirado';
        RETURN;
    END IF;

    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        cliente_id,
        cliente_nome,
        cliente_telefone,
        valor_cashback,
        saldo_total,
        status
    ) VALUES (
        p_cliente_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_valor_cashback,
        p_saldo_total,
        'PENDING'
    );
    
    RAISE NOTICE 'WhatsApp de cashback enfileirado para % (tel: %)', p_cliente_nome, p_cliente_telefone;
END;
$$;

-- ============================================================================
-- PARTE 3: ATUALIZAR FUNÇÃO gerar_cashback_from_sale PARA ENFILEIRAR CORRETAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback_from_sale(
    p_sale_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id UUID;
    v_cliente_nome TEXT;
    v_cliente_telefone TEXT;
    v_valor_venda NUMERIC;
    v_percentual_cashback NUMERIC;
    v_valor_cashback NUMERIC;
    v_colaboradora_id UUID;
    v_store_id UUID;
    v_transaction_id UUID;
    v_prazo_liberacao INTEGER;
    v_prazo_expiracao INTEGER;
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_cashback_ativo BOOLEAN;
    v_existing_transaction UUID;
    v_saldo_total NUMERIC;
BEGIN
    -- Buscar dados da venda
    SELECT 
        COALESCE(s.cliente_id, s.tiny_contact_id),
        COALESCE(s.cliente_nome, tc.nome, cc.nome),
        COALESCE(s.cliente_telefone, tc.telefone, cc.telefone),
        s.valor,
        s.colaboradora_id,
        s.store_id
    INTO 
        v_cliente_id,
        v_cliente_nome,
        v_cliente_telefone,
        v_valor_venda,
        v_colaboradora_id,
        v_store_id
    FROM sistemaretiradas.sales s
    LEFT JOIN sistemaretiradas.tiny_contacts tc ON tc.id = s.tiny_contact_id
    LEFT JOIN sistemaretiradas.crm_contacts cc ON cc.id = s.cliente_id
    WHERE s.id = p_sale_id;

    -- Verificar se encontrou a venda
    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Venda não encontrada'
        );
    END IF;

    -- Verificar se cliente está identificado
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente não identificado (CPF necessário para cashback)'
        );
    END IF;

    -- Verificar se já existe transação para esta venda (evitar duplicatas)
    SELECT id INTO v_existing_transaction
    FROM sistemaretiradas.cashback_transactions
    WHERE sale_id = p_sale_id
    LIMIT 1;

    IF v_existing_transaction IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cashback já gerado para esta venda',
            'existing_transaction_id', v_existing_transaction
        );
    END IF;

    -- Verificar se loja tem cashback ativo
    SELECT cashback_ativo INTO v_cashback_ativo
    FROM sistemaretiradas.stores
    WHERE id = v_store_id;

    IF v_cashback_ativo IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cashback não está ativo para esta loja'
        );
    END IF;

    -- Buscar configurações de cashback (específica da loja ou global)
    SELECT 
        COALESCE(cs.percentual_cashback, 15),
        COALESCE(cs.prazo_liberacao_dias, 2),
        COALESCE(cs.prazo_expiracao_dias, 30)
    INTO 
        v_percentual_cashback,
        v_prazo_liberacao,
        v_prazo_expiracao
    FROM sistemaretiradas.cashback_settings cs
    WHERE cs.store_id = v_store_id OR cs.store_id IS NULL
    ORDER BY cs.store_id NULLS LAST
    LIMIT 1;

    -- Se não houver configuração, usar padrões
    IF v_percentual_cashback IS NULL THEN
        v_percentual_cashback := 15;
        v_prazo_liberacao := 2;
        v_prazo_expiracao := 30;
    END IF;

    -- Calcular cashback (arredondar para cima)
    v_valor_cashback := CEIL((v_valor_venda * v_percentual_cashback / 100));

    -- Calcular datas
    v_data_liberacao := NOW() + (v_prazo_liberacao || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_prazo_expiracao || ' days')::INTERVAL;

    -- Inserir transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao,
        sale_id,
        colaboradora_id,
        store_id,
        renovado
    ) VALUES (
        v_cliente_id,
        'EARNED',
        v_valor_cashback,
        'Cashback de compra - Venda #' || LEFT(p_sale_id::TEXT, 8),
        v_data_liberacao,
        v_data_expiracao,
        p_sale_id,
        v_colaboradora_id,
        v_store_id,
        false
    ) RETURNING id INTO v_transaction_id;

    -- Atualizar ou criar saldo do cliente
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        balance,
        balance_disponivel,
        balance_pendente,
        total_earned,
        store_id
    ) VALUES (
        v_cliente_id,
        v_valor_cashback,
        0,
        v_valor_cashback,
        v_valor_cashback,
        v_store_id
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET 
        balance = sistemaretiradas.cashback_balance.balance + v_valor_cashback,
        balance_pendente = sistemaretiradas.cashback_balance.balance_pendente + v_valor_cashback,
        total_earned = sistemaretiradas.cashback_balance.total_earned + v_valor_cashback,
        updated_at = NOW()
    RETURNING balance INTO v_saldo_total;

    -- Enfileirar notificação WhatsApp
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_cashback,
            v_saldo_total
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao enfileirar WhatsApp: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'valor_cashback', v_valor_cashback,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao,
        'cliente_telefone', v_cliente_telefone
    );
END;
$$;

-- ============================================================================
-- PARTE 4: RLS PARA TABELA DE FILA
-- ============================================================================

ALTER TABLE sistemaretiradas.cashback_whatsapp_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view cashback_whatsapp_queue" ON sistemaretiradas.cashback_whatsapp_queue;
CREATE POLICY "Admins can view cashback_whatsapp_queue"
ON sistemaretiradas.cashback_whatsapp_queue
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);

DROP POLICY IF EXISTS "Service role can manage cashback_whatsapp_queue" ON sistemaretiradas.cashback_whatsapp_queue;
CREATE POLICY "Service role can manage cashback_whatsapp_queue"
ON sistemaretiradas.cashback_whatsapp_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_has_table BOOLEAN;
    v_has_function BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'cashback_whatsapp_queue'
    ) INTO v_has_table;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'enqueue_cashback_whatsapp'
        AND pronamespace = 'sistemaretiradas'::regnamespace
    ) INTO v_has_function;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICAÇÃO DA FILA DE WHATSAPP';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Tabela cashback_whatsapp_queue: %', CASE WHEN v_has_table THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE 'Função enqueue_cashback_whatsapp: %', CASE WHEN v_has_function THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE '============================================================';
END $$;
