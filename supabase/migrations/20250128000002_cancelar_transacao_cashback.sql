-- ============================================================================
-- RPC: Cancelar Transação de Cashback
-- Data: 2025-11-28
-- Descrição: Permite cancelar qualquer lançamento ou resgate de cashback
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.cancelar_transacao_cashback(
    p_transaction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_transaction sistemaretiradas.cashback_transactions;
    v_cancel_transaction_id UUID;
BEGIN
    -- Buscar transação
    SELECT * INTO v_transaction
    FROM sistemaretiradas.cashback_transactions
    WHERE id = p_transaction_id;
    
    IF v_transaction IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transação não encontrada'
        );
    END IF;
    
    -- Verificar se já foi cancelada
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions
        WHERE transaction_type = 'ADJUSTMENT'
        AND description LIKE '%Cancelamento da transação ' || p_transaction_id || '%'
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transação já foi cancelada'
        );
    END IF;
    
    -- Criar transação de cancelamento (valor inverso)
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        v_transaction.cliente_id,
        v_transaction.tiny_order_id,
        'ADJUSTMENT',
        -v_transaction.amount, -- Valor inverso para cancelar
        'Cancelamento da transação ' || p_transaction_id,
        NOW(),
        NULL
    )
    RETURNING id INTO v_cancel_transaction_id;
    
    -- Saldo é atualizado automaticamente pelo trigger
    
    RETURN json_build_object(
        'success', true,
        'message', 'Transação cancelada com sucesso',
        'cancel_transaction_id', v_cancel_transaction_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.cancelar_transacao_cashback IS 'Cancela uma transação de cashback criando um ajuste inverso';
