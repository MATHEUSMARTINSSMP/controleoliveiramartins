-- ============================================================================
-- MIGRATION: RPCs para Lançamento e Resgate Manual de Cashback
-- Data: 2025-11-28
-- Descrição: Funções para admin lançar e resgatar cashback manualmente
-- ============================================================================

-- ============================================================================
-- 1. RPC: Lançar Cashback Manual (Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.lancar_cashback_manual(
    p_cliente_id UUID,
    p_valor NUMERIC,
    p_descricao TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_settings sistemaretiradas.cashback_settings;
    v_cashback_amount NUMERIC;
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_transaction_id UUID;
    v_cliente_cpf TEXT;
BEGIN
    -- 🔴 VALIDAÇÃO OBRIGATÓRIA: Cliente DEVE ter CPF
    SELECT cpf_cnpj INTO v_cliente_cpf
    FROM sistemaretiradas.tiny_contacts
    WHERE id = p_cliente_id;
    
    IF v_cliente_cpf IS NULL OR TRIM(v_cliente_cpf) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cliente sem CPF/CNPJ. Cashback não pode ser lançado.'
        );
    END IF;
    
    -- Obter configurações (global, já que é lançamento manual)
    v_settings := sistemaretiradas.get_cashback_settings(NULL);
    
    -- Calcular valor do cashback
    v_cashback_amount := ROUND((p_valor * v_settings.percentual_cashback) / 100, 2);
    
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
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        p_cliente_id,
        NULL, -- Lançamento manual não tem pedido vinculado
        'EARNED',
        v_cashback_amount,
        COALESCE(p_descricao, 'Lançamento manual de cashback'),
        v_data_liberacao,
        v_data_expiracao
    )
    RETURNING id INTO v_transaction_id;
    
    -- Saldo é atualizado automaticamente pelo trigger
    
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

COMMENT ON FUNCTION sistemaretiradas.lancar_cashback_manual IS 'Lança cashback manualmente para um cliente (uso administrativo)';

-- ============================================================================
-- 2. RPC: Resgatar Cashback Manual (Admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.resgatar_cashback_manual(
    p_cliente_id UUID,
    p_valor NUMERIC,
    p_descricao TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance_disponivel NUMERIC;
    v_transaction_id UUID;
BEGIN
    -- Buscar saldo disponível do cliente
    SELECT balance_disponivel INTO v_balance_disponivel
    FROM sistemaretiradas.cashback_balance
    WHERE cliente_id = p_cliente_id;
    
    IF v_balance_disponivel IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cliente não possui saldo de cashback'
        );
    END IF;
    
    -- Validar se tem saldo suficiente
    IF v_balance_disponivel < p_valor THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Saldo insuficiente',
            'saldo_disponivel', v_balance_disponivel
        );
    END IF;
    
    -- Criar transação de resgate
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
        NULL,
        'REDEEMED',
        p_valor,
        COALESCE(p_descricao, 'Resgate manual de cashback'),
        NOW(),
        NULL
    )
    RETURNING id INTO v_transaction_id;
    
    -- Saldo é atualizado automaticamente pelo trigger
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback resgatado com sucesso',
        'transaction_id', v_transaction_id,
        'valor_resgatado', p_valor,
        'novo_saldo', v_balance_disponivel - p_valor
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.resgatar_cashback_manual IS 'Resgata cashback manualmente para um cliente (uso administrativo)';
