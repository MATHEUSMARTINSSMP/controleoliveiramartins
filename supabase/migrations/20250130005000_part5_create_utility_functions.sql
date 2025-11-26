-- =============================================================================
-- Migration PARTE 5: Funções utilitárias para cashback
-- Data: 2025-01-30
-- Descrição: Funções para atualizar saldos, renovar cashback e consultas
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- FUNÇÃO: Atualizar saldos quando cashback é liberado
-- =============================================================================

CREATE OR REPLACE FUNCTION update_cashback_balances_on_liberation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    -- Verificar se as tabelas existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name IN ('cashback_balance', 'cashback_transactions')
    ) THEN
        RETURN; -- Tabelas não existem ainda
    END IF;

    -- Atualizar saldos: mover de pendente para disponível
    UPDATE cashback_balance cb
    SET 
        balance_disponivel = balance_disponivel + (
            SELECT COALESCE(SUM(ct.amount), 0)
            FROM cashback_transactions ct
            WHERE ct.cliente_id = cb.cliente_id
            AND ct.transaction_type = 'EARNED'
            AND ct.data_liberacao <= NOW()
            AND ct.data_liberacao > COALESCE(cb.updated_at, cb.created_at)
        ),
        balance_pendente = balance_pendente - (
            SELECT COALESCE(SUM(ct.amount), 0)
            FROM cashback_transactions ct
            WHERE ct.cliente_id = cb.cliente_id
            AND ct.transaction_type = 'EARNED'
            AND ct.data_liberacao <= NOW()
            AND ct.data_liberacao > COALESCE(cb.updated_at, cb.created_at)
        ),
        updated_at = NOW()
    WHERE cb.cliente_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM cashback_transactions ct
        WHERE ct.cliente_id = cb.cliente_id
        AND ct.transaction_type = 'EARNED'
        AND ct.data_liberacao <= NOW()
        AND ct.data_liberacao > COALESCE(cb.updated_at, cb.created_at)
    );
END;
$$;

COMMENT ON FUNCTION update_cashback_balances_on_liberation() IS 'Atualiza saldos de cashback quando data_liberacao chega (mover de pendente para disponível)';

-- =============================================================================
-- FUNÇÃO: Renovar Cashback
-- =============================================================================

CREATE OR REPLACE FUNCTION renovar_cashback(
    p_transaction_id UUID,
    p_cliente_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_transaction RECORD;
    v_settings RECORD;
    v_nova_data_expiracao TIMESTAMP;
    v_result JSON;
BEGIN
    -- Verificar se as tabelas existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name IN ('cashback_transactions', 'cashback_settings', 'tiny_contacts')
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Tabelas necessárias não existem'
        );
    END IF;

    -- Buscar transação
    SELECT * INTO v_transaction
    FROM cashback_transactions
    WHERE id = p_transaction_id
    AND transaction_type = 'EARNED'
    AND (p_cliente_id IS NULL OR cliente_id = p_cliente_id);

    IF v_transaction IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transação não encontrada ou inválida'
        );
    END IF;

    -- Buscar configurações
    SELECT * INTO v_settings
    FROM cashback_settings
    WHERE renovacao_habilitada = true
    AND (
        store_id = (SELECT store_id FROM tiny_contacts WHERE id = v_transaction.cliente_id) 
        OR store_id IS NULL
    )
    ORDER BY 
        CASE WHEN store_id = (SELECT store_id FROM tiny_contacts WHERE id = v_transaction.cliente_id) THEN 0 ELSE 1 END,
        created_at DESC
    LIMIT 1;

    IF v_settings IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Renovação de cashback não está habilitada'
        );
    END IF;

    -- Calcular nova data de expiração
    v_nova_data_expiracao := COALESCE(v_transaction.data_expiracao, NOW()) + (v_settings.renovacao_dias || ' days')::INTERVAL;

    -- Atualizar transação
    UPDATE cashback_transactions
    SET 
        data_expiracao = v_nova_data_expiracao,
        renovado = true,
        recuperado = true -- Renovação manual
    WHERE id = p_transaction_id;

    RETURN json_build_object(
        'success', true,
        'nova_data_expiracao', v_nova_data_expiracao,
        'message', 'Cashback renovado com sucesso por mais ' || v_settings.renovacao_dias || ' dias'
    );
END;
$$;

COMMENT ON FUNCTION renovar_cashback(UUID, UUID) IS 'Renova o prazo de expiração de um cashback específico';

-- =============================================================================
-- FUNÇÃO: Obter resumo de cashback de um cliente
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cashback_summary_for_client(p_cliente_id UUID)
RETURNS TABLE (
    balance_disponivel DECIMAL(10,2),
    balance_pendente DECIMAL(10,2),
    balance_total DECIMAL(10,2),
    total_earned DECIMAL(10,2),
    total_redeemed DECIMAL(10,2),
    data_expiracao_proximo TIMESTAMP,
    valor_expiracao_proximo DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    -- Verificar se a tabela existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), NULL::TIMESTAMP, 0::DECIMAL(10,2);
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(cb.balance_disponivel, 0)::DECIMAL(10,2),
        COALESCE(cb.balance_pendente, 0)::DECIMAL(10,2),
        COALESCE(cb.balance, 0)::DECIMAL(10,2),
        COALESCE(cb.total_earned, 0)::DECIMAL(10,2),
        COALESCE(cb.total_redeemed, 0)::DECIMAL(10,2),
        cb.data_expiracao_proximo,
        COALESCE(cb.valor_expiracao_proximo, 0)::DECIMAL(10,2)
    FROM cashback_balance cb
    WHERE cb.cliente_id = p_cliente_id;
    
    -- Se não houver registro, retorna zeros
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), NULL::TIMESTAMP, 0::DECIMAL(10,2);
    END IF;
END;
$$;

COMMENT ON FUNCTION get_cashback_summary_for_client(UUID) IS 'Retorna resumo do cashback de um cliente';

-- =============================================================================
-- FUNÇÃO: Obter histórico de cashback de um cliente
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cashback_history_for_client(
    p_cliente_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    transaction_type TEXT,
    amount DECIMAL(10,2),
    description TEXT,
    data_liberacao TIMESTAMP,
    data_expiracao TIMESTAMP,
    renovado BOOLEAN,
    recuperado BOOLEAN,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    -- Verificar se a tabela existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        RETURN; -- Retorna vazio
    END IF;

    RETURN QUERY
    SELECT 
        ct.id,
        ct.transaction_type,
        ct.amount,
        ct.description,
        ct.data_liberacao,
        ct.data_expiracao,
        COALESCE(ct.renovado, false),
        COALESCE(ct.recuperado, false),
        ct.created_at
    FROM cashback_transactions ct
    WHERE ct.cliente_id = p_cliente_id
    ORDER BY ct.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_cashback_history_for_client(UUID, INTEGER, INTEGER) IS 'Retorna histórico de transações de cashback de um cliente';

