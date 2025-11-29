-- ============================================================================
-- MIGRATION: Adicionar SECURITY DEFINER nas funções de cashback
-- Data: 2025-01-28
-- Descrição: Funções que criam/atualizam cashback_balance precisam de SECURITY DEFINER
--            para poder criar linhas inicialmente, ignorando RLS
-- ============================================================================

-- ============================================================================
-- 1. ATUALIZAR FUNÇÃO: atualizar_saldo_cliente_cashback
-- Esta função é chamada por triggers e precisa criar/atualizar saldos
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.atualizar_saldo_cliente_cashback(p_cliente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_balance_disponivel NUMERIC(10,2) := 0;
    v_balance_pendente NUMERIC(10,2) := 0;
    v_total_earned NUMERIC(10,2) := 0;
BEGIN
    -- Calcular saldos baseado nas transações do cliente
    SELECT
        COALESCE(SUM(CASE 
            WHEN transaction_type = 'EARNED' 
                AND (data_liberacao IS NULL OR data_liberacao <= v_now) 
                AND (data_expiracao IS NULL OR data_expiracao > v_now)
            THEN amount 
            ELSE 0 
        END), 0) - 
        COALESCE(SUM(CASE 
            WHEN transaction_type = 'REDEEMED' 
            THEN amount 
            ELSE 0 
        END), 0),
        COALESCE(SUM(CASE 
            WHEN transaction_type = 'EARNED' 
                AND data_liberacao IS NOT NULL 
                AND data_liberacao > v_now
            THEN amount 
            ELSE 0 
        END), 0),
        COALESCE(SUM(CASE 
            WHEN transaction_type = 'EARNED' 
            THEN amount 
            ELSE 0 
        END), 0)
    INTO v_balance_disponivel, v_balance_pendente, v_total_earned
    FROM sistemaretiradas.cashback_transactions
    WHERE cliente_id = p_cliente_id
      AND transaction_type IN ('EARNED', 'REDEEMED');
    
    -- Garantir valores não negativos
    v_balance_disponivel := GREATEST(v_balance_disponivel, 0);
    v_balance_pendente := GREATEST(v_balance_pendente, 0);
    v_total_earned := GREATEST(v_total_earned, 0);
    
    -- Atualizar ou criar saldo (SECURITY DEFINER permite criar mesmo com RLS)
    -- Usar nome da constraint explicitamente para evitar erro 42P10
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        balance,
        balance_disponivel,
        balance_pendente,
        total_earned
    ) VALUES (
        p_cliente_id,
        v_balance_disponivel + v_balance_pendente,
        v_balance_disponivel,
        v_balance_pendente,
        v_total_earned
    )
    ON CONFLICT ON CONSTRAINT cashback_balance_unique_cliente DO UPDATE
    SET
        balance = EXCLUDED.balance,
        balance_disponivel = EXCLUDED.balance_disponivel,
        balance_pendente = EXCLUDED.balance_pendente,
        total_earned = EXCLUDED.total_earned,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- 2. ATUALIZAR FUNÇÃO: gerar_cashback
-- Esta função também cria/atualiza saldos
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
BEGIN
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(p_store_id);
    
    -- Calcular valor do cashback
    v_cashback_amount := ROUND((p_valor_total * v_settings.percentual_cashback) / 100, 2);
    
    -- Se não há cashback para gerar, retornar
    IF v_cashback_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Valor de cashback zero ou negativo'
        );
    END IF;
    
    -- Verificar se já existe cashback para este pedido
    SELECT id INTO v_transaction_id
    FROM sistemaretiradas.cashback_transactions
    WHERE tiny_order_id = p_tiny_order_id
      AND transaction_type = 'EARNED'
    LIMIT 1;
    
    -- Se já existe, não criar novamente
    IF v_transaction_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Cashback já foi gerado para este pedido'
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
        p_tiny_order_id,
        'EARNED',
        v_cashback_amount,
        'Cashback gerado automaticamente para pedido ' || p_tiny_order_id::TEXT,
        v_data_liberacao,
        v_data_expiracao
    )
    RETURNING id INTO v_transaction_id;
    
    -- Atualizar saldo (a função atualizar_saldo_cliente_cashback também tem SECURITY DEFINER)
    PERFORM sistemaretiradas.atualizar_saldo_cliente_cashback(p_cliente_id);
    
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

-- ============================================================================
-- 3. REMOVER POLÍTICA DE INSERT PARA FRONTEND EM cashback_balance
-- Apenas funções com SECURITY DEFINER devem criar saldos inicialmente
-- Frontend pode apenas fazer UPDATE se necessário
-- ============================================================================
DROP POLICY IF EXISTS "Admin e Loja podem inserir saldos de cashback" ON sistemaretiradas.cashback_balance;

-- Comentário explicativo
COMMENT ON FUNCTION sistemaretiradas.atualizar_saldo_cliente_cashback IS 'Atualiza saldo de cashback de um cliente. Usa SECURITY DEFINER para poder criar saldos inicialmente, ignorando RLS.';
COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 'Gera cashback para um pedido. Usa SECURITY DEFINER para poder criar transações e saldos, ignorando RLS.';

