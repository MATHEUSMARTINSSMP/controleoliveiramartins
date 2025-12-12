-- ============================================================================
-- MIGRATION: Criar Tabela de Fila para WhatsApp de Cashback
-- Data: 2025-01-31
-- Descrição: Cria tabela de fila para processar WhatsApp de cashback de forma confiável
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA DE FILA DE WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES sistemaretiradas.cashback_transactions(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES sistemaretiradas.tiny_contacts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_status ON sistemaretiradas.cashback_whatsapp_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_transaction ON sistemaretiradas.cashback_whatsapp_queue(transaction_id);

COMMENT ON TABLE sistemaretiradas.cashback_whatsapp_queue IS 'Fila de WhatsApp para envio de notificações de cashback gerado';
COMMENT ON COLUMN sistemaretiradas.cashback_whatsapp_queue.status IS 'Status: PENDING, PROCESSING, SENT, FAILED, SKIPPED';

-- ============================================================================
-- 2. FUNÇÃO: Adicionar à Fila (será chamada após gerar cashback)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_transaction_id UUID,
    p_cliente_id UUID,
    p_store_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    -- Verificar se já existe na fila para esta transação
    SELECT id INTO v_queue_id
    FROM sistemaretiradas.cashback_whatsapp_queue
    WHERE transaction_id = p_transaction_id
    LIMIT 1;
    
    IF v_queue_id IS NOT NULL THEN
        -- Já existe, retornar ID existente
        RETURN v_queue_id;
    END IF;
    
    -- Criar nova entrada na fila
    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        transaction_id,
        cliente_id,
        store_id,
        status
    ) VALUES (
        p_transaction_id,
        p_cliente_id,
        p_store_id,
        'PENDING'
    )
    RETURNING id INTO v_queue_id;
    
    RAISE NOTICE '✅ WhatsApp de cashback adicionado à fila (ID: %)', v_queue_id;
    
    RETURN v_queue_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao adicionar WhatsApp à fila (não bloqueia geração): %', SQLERRM;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.enqueue_cashback_whatsapp IS 'Adiciona entrada na fila para envio de WhatsApp de cashback';

-- ============================================================================
-- 3. MODIFICAR FUNÇÃO gerar_cashback: Usar fila em vez de chamada HTTP direta
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_tiny_order_id UUID,
    p_cliente_id UUID,
    p_store_id UUID,
    p_valor_total NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings sistemaretiradas.cashback_settings;
    v_cashback_amount NUMERIC;
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_transaction_id UUID;
    v_balance_id UUID;
    v_existing_balance sistemaretiradas.cashback_balance;
    v_queue_id UUID;
BEGIN
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(p_store_id);
    
    -- ✅ Calcular valor do cashback e arredondar PARA CIMA (sem centavos)
    v_cashback_amount := CEIL((p_valor_total * v_settings.percentual_cashback) / 100);
    
    -- Se não há cashback para gerar, retornar
    IF v_cashback_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Valor de cashback zero ou negativo'
        );
    END IF;
    
    -- Calcular datas
    v_data_liberacao := NOW() + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;
    
    -- Verificar se já existe transação para este pedido
    SELECT id INTO v_transaction_id
    FROM sistemaretiradas.cashback_transactions
    WHERE tiny_order_id = p_tiny_order_id
      AND transaction_type = 'EARNED'
    LIMIT 1;
    
    -- Se já existe, não criar novamente
    IF v_transaction_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Cashback já foi gerado para este pedido',
            'transaction_id', v_transaction_id
        );
    END IF;
    
    -- Criar transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        p_cliente_id,
        p_tiny_order_id,
        'EARNED',
        v_cashback_amount,
        'Cashback gerado automaticamente para pedido #' || (SELECT numero_pedido FROM sistemaretiradas.tiny_orders WHERE id = p_tiny_order_id),
        v_data_liberacao,
        v_data_expiracao
    )
    RETURNING id INTO v_transaction_id;
    
    -- Atualizar ou criar saldo
    SELECT * INTO v_existing_balance
    FROM sistemaretiradas.cashback_balance
    WHERE cliente_id = p_cliente_id
    LIMIT 1;
    
    IF v_existing_balance IS NULL THEN
        -- Criar novo saldo
        INSERT INTO sistemaretiradas.cashback_balance (
            cliente_id,
            balance,
            balance_pendente,
            total_earned
        ) VALUES (
            p_cliente_id,
            v_cashback_amount,
            v_cashback_amount,
            v_cashback_amount
        )
        RETURNING id INTO v_balance_id;
    ELSE
        -- Atualizar saldo existente
        UPDATE sistemaretiradas.cashback_balance
        SET balance = balance + v_cashback_amount,
            balance_pendente = balance_pendente + v_cashback_amount,
            total_earned = total_earned + v_cashback_amount,
            updated_at = NOW()
        WHERE cliente_id = p_cliente_id;
    END IF;
    
    -- ✅ NOVO: Adicionar à fila de WhatsApp (muito mais confiável que chamada HTTP direta)
    BEGIN
        v_queue_id := sistemaretiradas.enqueue_cashback_whatsapp(
            v_transaction_id,
            p_cliente_id,
            p_store_id
        );
        
        IF v_queue_id IS NOT NULL THEN
            RAISE NOTICE '✅ WhatsApp de cashback adicionado à fila (Queue ID: %)', v_queue_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Não falhar a geração de cashback por causa do WhatsApp
        RAISE WARNING '⚠️ Erro ao adicionar WhatsApp à fila (não bloqueia geração): %', SQLERRM;
    END;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback gerado com sucesso',
        'transaction_id', v_transaction_id,
        'amount', v_cashback_amount,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao,
        'whatsapp_queue_id', v_queue_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 
-- 'Gera cashback automaticamente para um pedido. Arredonda para cima (sem centavos). Adiciona WhatsApp à fila.';

-- ============================================================================
-- 4. RLS PARA TABELA DE FILA
-- ============================================================================

ALTER TABLE sistemaretiradas.cashback_whatsapp_queue ENABLE ROW LEVEL SECURITY;

-- Apenas ADMIN pode ver a fila
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

-- Service role pode fazer tudo (para processamento automático)
DROP POLICY IF EXISTS "Service role can manage cashback_whatsapp_queue" ON sistemaretiradas.cashback_whatsapp_queue;
CREATE POLICY "Service role can manage cashback_whatsapp_queue"
ON sistemaretiradas.cashback_whatsapp_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

