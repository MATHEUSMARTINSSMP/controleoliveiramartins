-- ============================================================================
-- MIGRATION: Adicionar Multi-Tenancy ao Sistema de Cashback
-- Data: 2025-02-01
-- Descrição: Adiciona store_id e colaboradora_id às tabelas de cashback
--            e atualiza funções para garantir isolamento total de dados
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNAS store_id e colaboradora_id em cashback_balance
-- ============================================================================
ALTER TABLE sistemaretiradas.cashback_balance
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cashback_balance_store ON sistemaretiradas.cashback_balance(store_id);
CREATE INDEX IF NOT EXISTS idx_cashback_balance_colaboradora ON sistemaretiradas.cashback_balance(colaboradora_id);

-- Comentários
COMMENT ON COLUMN sistemaretiradas.cashback_balance.store_id IS 'Loja à qual o saldo pertence (multi-tenancy)';
COMMENT ON COLUMN sistemaretiradas.cashback_balance.colaboradora_id IS 'Colaboradora responsável pela venda (multi-tenancy)';

-- ============================================================================
-- 2. ADICIONAR COLUNAS store_id e colaboradora_id em cashback_transactions
-- ============================================================================
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE CASCADE;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_store ON sistemaretiradas.cashback_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_colaboradora ON sistemaretiradas.cashback_transactions(colaboradora_id);

-- Comentários
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.store_id IS 'Loja à qual a transação pertence (multi-tenancy)';
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.colaboradora_id IS 'Colaboradora responsável pela venda (multi-tenancy)';

-- ============================================================================
-- 3. POPULAR store_id e colaboradora_id EXISTENTES
-- ============================================================================

-- Atualizar cashback_balance com base em tiny_contacts
UPDATE sistemaretiradas.cashback_balance cb
SET 
    store_id = tc.store_id,
    colaboradora_id = tc.colaboradora_id
FROM sistemaretiradas.tiny_contacts tc
WHERE cb.cliente_id = tc.id
  AND (cb.store_id IS NULL OR cb.colaboradora_id IS NULL);

-- Atualizar cashback_transactions com base em tiny_orders
UPDATE sistemaretiradas.cashback_transactions ct
SET 
    store_id = tor.store_id,
    colaboradora_id = tor.colaboradora_id
FROM sistemaretiradas.tiny_orders tor
WHERE ct.tiny_order_id = tor.id
  AND (ct.store_id IS NULL OR ct.colaboradora_id IS NULL);

-- ============================================================================
-- 4. ATUALIZAR FUNÇÃO gerar_cashback
-- ============================================================================

-- Dropar versão antiga para atualizar assinatura
DROP FUNCTION IF EXISTS sistemaretiradas.gerar_cashback(UUID, UUID, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_tiny_order_id UUID,
    p_cliente_id UUID,
    p_store_id UUID,
    p_colaboradora_id UUID, -- NOVO PARÂMETRO
    p_valor_total NUMERIC
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
    
    -- Criar transação (COM STORE_ID E COLABORADORA_ID)
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tiny_order_id,
        store_id,           -- NOVO
        colaboradora_id,    -- NOVO
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        p_cliente_id,
        p_tiny_order_id,
        p_store_id,         -- NOVO
        p_colaboradora_id,  -- NOVO
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
        -- Criar novo saldo (COM STORE_ID E COLABORADORA_ID)
        INSERT INTO sistemaretiradas.cashback_balance (
            cliente_id,
            store_id,           -- NOVO
            colaboradora_id,    -- NOVO
            balance,
            balance_pendente,
            total_earned
        ) VALUES (
            p_cliente_id,
            p_store_id,         -- NOVO
            p_colaboradora_id,  -- NOVO
            v_cashback_amount,
            v_cashback_amount,
            v_cashback_amount
        )
        RETURNING id INTO v_balance_id;
    ELSE
        -- Atualizar saldo existente
        -- Nota: Não atualizamos store_id/colaboradora_id aqui pois assume-se que o cliente pertence à loja
        -- Mas poderíamos atualizar se o cliente mudou de loja (depende da regra de negócio)
        -- Por segurança, vamos manter o original do cliente
        UPDATE sistemaretiradas.cashback_balance
        SET balance = balance + v_cashback_amount,
            balance_pendente = balance_pendente + v_cashback_amount,
            total_earned = total_earned + v_cashback_amount,
            updated_at = NOW()
        WHERE cliente_id = p_cliente_id;
    END IF;
    
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

COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 'Gera cashback automaticamente para um pedido (com suporte a multi-tenancy)';

-- ============================================================================
-- 5. ATUALIZAR FUNÇÃO atualizar_saldos_cashback
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.atualizar_saldos_cashback()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER := 0;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Atualizar saldos de todos os clientes com base nas transações
    WITH saldo_calculado AS (
        SELECT
            cliente_id,
            -- Pegar store_id e colaboradora_id da transação mais recente ou agrupada
            -- Como cliente pertence a uma loja, qualquer transação serve, usamos MAX para pegar um valor não nulo
            MAX(store_id) as store_id,
            MAX(colaboradora_id) as colaboradora_id,
            COALESCE(SUM(CASE WHEN transaction_type = 'EARNED' AND (data_liberacao IS NULL OR data_liberacao <= v_now) AND (data_expiracao IS NULL OR data_expiracao > v_now) THEN amount ELSE 0 END), 0) - 
            COALESCE(SUM(CASE WHEN transaction_type = 'REDEEMED' THEN amount ELSE 0 END), 0) as balance_disponivel,
            COALESCE(SUM(CASE WHEN transaction_type = 'EARNED' AND data_liberacao > v_now THEN amount ELSE 0 END), 0) as balance_pendente,
            COALESCE(SUM(CASE WHEN transaction_type = 'EARNED' THEN amount ELSE 0 END), 0) as total_earned
        FROM sistemaretiradas.cashback_transactions
        WHERE transaction_type IN ('EARNED', 'REDEEMED')
        GROUP BY cliente_id
    )
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        store_id,        -- NOVO
        colaboradora_id, -- NOVO
        balance,
        balance_disponivel,
        balance_pendente,
        total_earned
    )
    SELECT
        cliente_id,
        store_id,        -- NOVO
        colaboradora_id, -- NOVO
        balance_disponivel + balance_pendente,
        balance_disponivel,
        balance_pendente,
        total_earned
    FROM saldo_calculado
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        -- Atualizar store_id e colaboradora_id caso estejam nulos
        store_id = COALESCE(sistemaretiradas.cashback_balance.store_id, EXCLUDED.store_id),
        colaboradora_id = COALESCE(sistemaretiradas.cashback_balance.colaboradora_id, EXCLUDED.colaboradora_id),
        balance = EXCLUDED.balance,
        balance_disponivel = EXCLUDED.balance_disponivel,
        balance_pendente = EXCLUDED.balance_pendente,
        total_earned = EXCLUDED.total_earned,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RETURN v_updated;
END;
$$;
