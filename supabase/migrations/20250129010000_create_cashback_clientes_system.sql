-- =============================================================================
-- SISTEMA DE CASHBACK PARA CLIENTES (Tiny ERP)
-- =============================================================================
-- Este sistema permite que CLIENTES ganhem cashback em compras
-- e resgatem créditos em próximas compras.
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. TABELA: cashback_balance_clientes
-- =============================================================================
-- Armazena o saldo atual de cashback de cada cliente
CREATE TABLE IF NOT EXISTS cashback_balance_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES tiny_contacts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    balance_disponivel DECIMAL(10,2) DEFAULT 0 CHECK (balance_disponivel >= 0),
    balance_pendente DECIMAL(10,2) DEFAULT 0 CHECK (balance_pendente >= 0),
    total_earned DECIMAL(10,2) DEFAULT 0 CHECK (total_earned >= 0),
    total_redeemed DECIMAL(10,2) DEFAULT 0 CHECK (total_redeemed >= 0),
    total_expired DECIMAL(10,2) DEFAULT 0 CHECK (total_expired >= 0),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cliente_id, store_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_balance_clientes_cliente ON cashback_balance_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_balance_clientes_store ON cashback_balance_clientes(store_id);
CREATE INDEX IF NOT EXISTS idx_cashback_balance_clientes_updated ON cashback_balance_clientes(updated_at);

-- Comentários
COMMENT ON TABLE cashback_balance_clientes IS 'Saldo atual de cashback por cliente';
COMMENT ON COLUMN cashback_balance_clientes.balance_disponivel IS 'Saldo disponível para uso (liberado e não expirado)';
COMMENT ON COLUMN cashback_balance_clientes.balance_pendente IS 'Saldo pendente de liberação';
COMMENT ON COLUMN cashback_balance_clientes.total_earned IS 'Total acumulado de cashback ganho';
COMMENT ON COLUMN cashback_balance_clientes.total_redeemed IS 'Total de cashback resgatado';
COMMENT ON COLUMN cashback_balance_clientes.total_expired IS 'Total de cashback expirado';

-- =============================================================================
-- 2. TABELA: cashback_transactions_clientes
-- =============================================================================
-- Histórico completo de todas as transações de cashback de clientes
CREATE TABLE IF NOT EXISTS cashback_transactions_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES tiny_contacts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    order_id UUID REFERENCES tiny_orders(id) ON DELETE SET NULL, -- Pedido que gerou/usou cashback
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'RENEWED', 'ADJUSTMENT')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    data_liberacao TIMESTAMP, -- Quando o cashback fica disponível para uso
    data_expiracao TIMESTAMP, -- Quando o cashback expira
    renovado BOOLEAN DEFAULT false, -- Se foi renovado automaticamente
    recuperado BOOLEAN DEFAULT false, -- Se foi recuperado/renovado manualmente
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_cliente ON cashback_transactions_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_store ON cashback_transactions_clientes(store_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_order ON cashback_transactions_clientes(order_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_type ON cashback_transactions_clientes(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_created ON cashback_transactions_clientes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_data_liberacao ON cashback_transactions_clientes(data_liberacao) WHERE data_liberacao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_clientes_data_expiracao ON cashback_transactions_clientes(data_expiracao) WHERE data_expiracao IS NOT NULL;

-- Comentários
COMMENT ON TABLE cashback_transactions_clientes IS 'Histórico de transações de cashback de clientes';
COMMENT ON COLUMN cashback_transactions_clientes.transaction_type IS 'Tipo: EARNED (ganho), REDEEMED (resgatado), EXPIRED (expirado), RENEWED (renovado), ADJUSTMENT (ajuste manual)';
COMMENT ON COLUMN cashback_transactions_clientes.data_liberacao IS 'Data em que o cashback fica disponível para uso';
COMMENT ON COLUMN cashback_transactions_clientes.data_expiracao IS 'Data em que o cashback expira';
COMMENT ON COLUMN cashback_transactions_clientes.renovado IS 'Indica se o cashback foi renovado automaticamente';
COMMENT ON COLUMN cashback_transactions_clientes.recuperado IS 'Indica se o cashback foi recuperado/renovado manualmente';

-- =============================================================================
-- 3. FUNÇÃO: generate_cashback_for_order
-- =============================================================================
-- Gera cashback automaticamente quando um pedido é criado/atualizado
CREATE OR REPLACE FUNCTION generate_cashback_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_cashback_amount DECIMAL(10,2) := 0;
    v_settings cashback_settings%ROWTYPE;
    v_data_liberacao TIMESTAMP;
    v_data_expiracao TIMESTAMP;
    v_balance_id UUID;
    v_current_balance_disponivel DECIMAL(10,2);
    v_current_balance_pendente DECIMAL(10,2);
BEGIN
    -- Apenas processar pedidos faturados/aprovados com valor > 0
    IF NEW.valor_total IS NULL OR NEW.valor_total <= 0 THEN
        RETURN NEW;
    END IF;

    -- Verificar se tem cliente associado
    IF NEW.cliente_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Buscar configurações de cashback (prioridade: loja específica > global)
    SELECT * INTO v_settings
    FROM cashback_settings
    WHERE (store_id = NEW.store_id OR store_id IS NULL)
    ORDER BY 
        CASE WHEN store_id IS NOT NULL THEN 1 ELSE 2 END -- Loja específica primeiro
    LIMIT 1;

    -- Se não houver configuração, não gera cashback
    IF v_settings IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular cashback
    v_cashback_amount := (NEW.valor_total * v_settings.percentual_cashback / 100);

    -- Se o cashback for zero ou negativo, não faz nada
    IF v_cashback_amount <= 0 THEN
        RETURN NEW;
    END IF;

    -- Calcular datas de liberação e expiração
    v_data_liberacao := NEW.data_pedido + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;

    -- Inserir ou atualizar saldo do cliente
    INSERT INTO cashback_balance_clientes (
        cliente_id,
        store_id,
        balance_pendente,
        total_earned
    )
    VALUES (
        NEW.cliente_id,
        NEW.store_id,
        v_cashback_amount,
        v_cashback_amount
    )
    ON CONFLICT (cliente_id, store_id) DO UPDATE
    SET 
        balance_pendente = cashback_balance_clientes.balance_pendente + v_cashback_amount,
        total_earned = cashback_balance_clientes.total_earned + v_cashback_amount,
        updated_at = NOW()
    RETURNING id INTO v_balance_id;

    -- Registrar transação
    INSERT INTO cashback_transactions_clientes (
        cliente_id,
        store_id,
        order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        NEW.cliente_id,
        NEW.store_id,
        NEW.id,
        'EARNED',
        v_cashback_amount,
        'Cashback de ' || v_settings.percentual_cashback || '% sobre compra de R$ ' || NEW.valor_total,
        v_data_liberacao,
        v_data_expiracao
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION generate_cashback_for_order() IS 'Gera cashback automaticamente quando um pedido é criado/atualizado';

-- =============================================================================
-- 4. TRIGGER: trigger_generate_cashback
-- =============================================================================
-- Dispara a geração de cashback automaticamente após inserir/atualizar pedido
DROP TRIGGER IF EXISTS trigger_generate_cashback ON tiny_orders;
CREATE TRIGGER trigger_generate_cashback
    AFTER INSERT OR UPDATE ON tiny_orders
    FOR EACH ROW
    WHEN (NEW.valor_total > 0 AND NEW.cliente_id IS NOT NULL)
    EXECUTE FUNCTION generate_cashback_for_order();

-- =============================================================================
-- 5. FUNÇÃO: process_cashback_liberation
-- =============================================================================
-- Processa a liberação de cashback pendente (move de pendente para disponível)
CREATE OR REPLACE FUNCTION process_cashback_liberation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_transaction cashback_transactions_clientes%ROWTYPE;
    v_amount DECIMAL(10,2);
BEGIN
    -- Buscar transações que devem ser liberadas hoje
    FOR v_transaction IN
        SELECT *
        FROM cashback_transactions_clientes
        WHERE transaction_type = 'EARNED'
            AND data_liberacao IS NOT NULL
            AND data_liberacao <= NOW()
            AND amount > 0
            AND NOT EXISTS (
                SELECT 1 FROM cashback_transactions_clientes t2
                WHERE t2.id = cashback_transactions_clientes.id
                    AND t2.transaction_type = 'RENEWED'
                    AND t2.created_at > cashback_transactions_clientes.data_liberacao
            )
    LOOP
        -- Atualizar saldo: mover de pendente para disponível
        UPDATE cashback_balance_clientes
        SET 
            balance_pendente = balance_pendente - v_transaction.amount,
            balance_disponivel = balance_disponivel + v_transaction.amount,
            updated_at = NOW()
        WHERE cliente_id = v_transaction.cliente_id
            AND store_id = v_transaction.store_id;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION process_cashback_liberation() IS 'Processa a liberação de cashback pendente (move de pendente para disponível)';

-- =============================================================================
-- 6. FUNÇÃO: process_cashback_expiration
-- =============================================================================
-- Processa a expiração de cashback disponível
CREATE OR REPLACE FUNCTION process_cashback_expiration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_transaction cashback_transactions_clientes%ROWTYPE;
    v_amount DECIMAL(10,2);
BEGIN
    -- Buscar transações que expiraram hoje
    FOR v_transaction IN
        SELECT *
        FROM cashback_transactions_clientes
        WHERE transaction_type = 'EARNED'
            AND data_expiracao IS NOT NULL
            AND data_expiracao <= NOW()
            AND amount > 0
            AND NOT EXISTS (
                SELECT 1 FROM cashback_transactions_clientes t2
                WHERE t2.id = cashback_transactions_clientes.id
                    AND t2.transaction_type IN ('EXPIRED', 'RENEWED')
            )
    LOOP
        -- Verificar se ainda há saldo disponível para expirar
        SELECT balance_disponivel INTO v_amount
        FROM cashback_balance_clientes
        WHERE cliente_id = v_transaction.cliente_id
            AND store_id = v_transaction.store_id;

        IF v_amount IS NOT NULL AND v_amount > 0 THEN
            -- Calcular quanto expirar (não pode ser mais que o disponível)
            v_amount := LEAST(v_transaction.amount, v_amount);

            -- Atualizar saldo: remover do disponível
            UPDATE cashback_balance_clientes
            SET 
                balance_disponivel = balance_disponivel - v_amount,
                total_expired = total_expired + v_amount,
                updated_at = NOW()
            WHERE cliente_id = v_transaction.cliente_id
                AND store_id = v_transaction.store_id;

            -- Registrar transação de expiração
            INSERT INTO cashback_transactions_clientes (
                cliente_id,
                store_id,
                order_id,
                transaction_type,
                amount,
                description
            ) VALUES (
                v_transaction.cliente_id,
                v_transaction.store_id,
                v_transaction.order_id,
                'EXPIRED',
                v_amount,
                'Cashback expirado após período de validade'
            );
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION process_cashback_expiration() IS 'Processa a expiração de cashback disponível';

-- =============================================================================
-- 7. FUNÇÃO RPC: renew_cashback_cliente
-- =============================================================================
-- Renova cashback de um cliente (adiciona dias ao prazo de expiração)
CREATE OR REPLACE FUNCTION renew_cashback_cliente(
    p_cliente_id UUID,
    p_store_id UUID,
    p_transaction_id UUID DEFAULT NULL -- Se fornecido, renova apenas essa transação
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_settings cashback_settings%ROWTYPE;
    v_transaction cashback_transactions_clientes%ROWTYPE;
    v_nova_data_expiracao TIMESTAMP;
    v_result JSON;
BEGIN
    -- Buscar configurações
    SELECT * INTO v_settings
    FROM cashback_settings
    WHERE (store_id = p_store_id OR store_id IS NULL)
    ORDER BY 
        CASE WHEN store_id IS NOT NULL THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_settings IS NULL OR NOT v_settings.renovacao_habilitada THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Renovação de cashback não está habilitada'
        );
    END IF;

    -- Se transaction_id fornecido, renova apenas essa transação
    IF p_transaction_id IS NOT NULL THEN
        SELECT * INTO v_transaction
        FROM cashback_transactions_clientes
        WHERE id = p_transaction_id
            AND cliente_id = p_cliente_id
            AND store_id = p_store_id
            AND transaction_type = 'EARNED';

        IF v_transaction IS NULL THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Transação não encontrada'
            );
        END IF;

        -- Calcular nova data de expiração
        v_nova_data_expiracao := COALESCE(v_transaction.data_expiracao, NOW()) + (v_settings.renovacao_dias || ' days')::INTERVAL;

        -- Atualizar transação
        UPDATE cashback_transactions_clientes
        SET 
            data_expiracao = v_nova_data_expiracao,
            renovado = true,
            recuperado = true
        WHERE id = p_transaction_id;

        -- Registrar transação de renovação
        INSERT INTO cashback_transactions_clientes (
            cliente_id,
            store_id,
            order_id,
            transaction_type,
            amount,
            description
        ) VALUES (
            p_cliente_id,
            p_store_id,
            v_transaction.order_id,
            'RENEWED',
            0,
            'Cashback renovado por mais ' || v_settings.renovacao_dias || ' dias'
        );

        RETURN json_build_object(
            'success', true,
            'message', 'Cashback renovado com sucesso',
            'nova_data_expiracao', v_nova_data_expiracao
        );
    ELSE
        -- Renovar todas as transações do cliente que estão próximas de expirar
        -- (implementação futura: renovar em lote)
        RETURN json_build_object(
            'success', false,
            'error', 'Renovação em lote ainda não implementada. Use transaction_id.'
        );
    END IF;
END;
$$;

COMMENT ON FUNCTION renew_cashback_cliente(UUID, UUID, UUID) IS 'Renova cashback de um cliente (adiciona dias ao prazo de expiração)';

-- =============================================================================
-- 8. RLS (Row Level Security)
-- =============================================================================

ALTER TABLE cashback_balance_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_transactions_clientes ENABLE ROW LEVEL SECURITY;

-- Política: ADMIN e LOJA podem ver tudo
DROP POLICY IF EXISTS "admin_loja_cashback_balance_clientes_all" ON cashback_balance_clientes;
CREATE POLICY "admin_loja_cashback_balance_clientes_all" ON cashback_balance_clientes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'LOJA')
        )
    );

DROP POLICY IF EXISTS "admin_loja_cashback_transactions_clientes_all" ON cashback_transactions_clientes;
CREATE POLICY "admin_loja_cashback_transactions_clientes_all" ON cashback_transactions_clientes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('ADMIN', 'LOJA')
        )
    );

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

