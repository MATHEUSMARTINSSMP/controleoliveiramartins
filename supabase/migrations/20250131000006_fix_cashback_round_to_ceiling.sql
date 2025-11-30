-- ============================================================================
-- MIGRATION: Arredondar Cashback para Cima (sem centavos)
-- Data: 2025-01-31
-- Descrição: Altera cálculo de cashback para arredondar para cima, sem centavos
-- Exemplos: 152.15 -> 153 | 77.07 -> 78
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR FUNÇÃO gerar_cashback()
-- ============================================================================
-- Alterar de ROUND(..., 2) para CEIL() para arredondar para cima sem centavos

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
    v_result JSON;
BEGIN
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(p_store_id);
    
    -- ✅ ALTERADO: Calcular valor do cashback e arredondar PARA CIMA (sem centavos)
    -- Exemplo: 152.15 -> 153 | 77.07 -> 78
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
    
    -- Enviar WhatsApp automaticamente (em background, não bloqueia)
    BEGIN
        -- Aguardar um pouco para garantir que a transação foi commitada
        PERFORM pg_sleep(0.5);
        
        -- Chamar função de envio de WhatsApp
        v_result := sistemaretiradas.enviar_whatsapp_cashback(
            v_transaction_id,
            p_cliente_id,
            p_store_id
        );
        
        IF (v_result->>'success')::BOOLEAN THEN
            RAISE NOTICE '✅ WhatsApp de cashback enviado com sucesso para cliente %', p_cliente_id;
        ELSE
            RAISE WARNING '⚠️ Falha ao enviar WhatsApp de cashback (não bloqueia): %', v_result->>'error';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Não falhar a geração de cashback por causa do WhatsApp
        RAISE WARNING '⚠️ Erro ao enviar WhatsApp de cashback (não bloqueia geração): %', SQLERRM;
    END;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback gerado com sucesso',
        'transaction_id', v_transaction_id,
        'amount', v_cashback_amount,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 
'Gera cashback automaticamente para um pedido. Arredonda para cima (sem centavos). Exemplo: 152.15 -> 153';

-- ============================================================================
-- 2. CORRIGIR FUNÇÃO lancar_cashback_manual()
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.lancar_cashback_manual(
    p_cliente_id UUID,
    p_valor NUMERIC,
    p_store_id UUID DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
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
BEGIN
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(p_store_id);
    
    -- ✅ ALTERADO: Calcular valor do cashback e arredondar PARA CIMA (sem centavos)
    v_cashback_amount := CEIL((p_valor * v_settings.percentual_cashback) / 100);
    
    IF v_cashback_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Valor de cashback zero ou negativo'
        );
    END IF;
    
    -- Calcular datas
    v_data_liberacao := NOW() + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;
    
    -- Criar transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        p_cliente_id,
        'EARNED',
        v_cashback_amount,
        COALESCE(p_observacoes, 'Cashback lançado manualmente'),
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
        UPDATE sistemaretiradas.cashback_balance
        SET balance = balance + v_cashback_amount,
            balance_pendente = balance_pendente + v_cashback_amount,
            total_earned = total_earned + v_cashback_amount,
            updated_at = NOW()
        WHERE cliente_id = p_cliente_id;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback lançado com sucesso',
        'transaction_id', v_transaction_id,
        'amount', v_cashback_amount,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.lancar_cashback_manual IS 
'Lança cashback manualmente para um cliente. Arredonda para cima (sem centavos). Exemplo: 152.15 -> 153';

