-- ============================================================================
-- MIGRATION: Sistema de Cashback Completo
-- Data: 2025-01-28
-- Descrição: Cria toda a estrutura do sistema de cashback (tabelas, RPCs, triggers)
-- ============================================================================

-- ============================================================================
-- 1. TABELA: cashback_settings
-- Configurações de cashback (global ou por loja)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    prazo_liberacao_dias INTEGER NOT NULL DEFAULT 2,
    prazo_expiracao_dias INTEGER NOT NULL DEFAULT 30,
    percentual_cashback NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    percentual_uso_maximo NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    renovacao_habilitada BOOLEAN NOT NULL DEFAULT true,
    renovacao_dias INTEGER NOT NULL DEFAULT 3,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Uma configuração global (store_id = NULL) ou por loja
    -- NULLS NOT DISTINCT garante que apenas UM registro com store_id NULL pode existir
    CONSTRAINT cashback_settings_unique_store UNIQUE NULLS NOT DISTINCT (store_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cashback_settings_store ON sistemaretiradas.cashback_settings(store_id);

-- Comentários
COMMENT ON TABLE sistemaretiradas.cashback_settings IS 'Configurações de cashback (global ou por loja)';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.store_id IS 'NULL = configuração global, UUID = configuração específica da loja';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.prazo_liberacao_dias IS 'Dias após a compra para liberar o cashback';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.prazo_expiracao_dias IS 'Dias após liberação para expirar o cashback';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.percentual_cashback IS 'Percentual de cashback gerado (ex: 15.00 = 15%)';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.percentual_uso_maximo IS 'Percentual máximo do valor da compra que pode ser pago com cashback';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.renovacao_habilitada IS 'Permite renovar cashback expirado';
COMMENT ON COLUMN sistemaretiradas.cashback_settings.renovacao_dias IS 'Dias adicionados ao prazo ao renovar';

-- ============================================================================
-- 2. TABELA: cashback_balance
-- Saldos de cashback por cliente
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES sistemaretiradas.tiny_contacts(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_disponivel NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_pendente NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Um saldo por cliente
    CONSTRAINT cashback_balance_unique_cliente UNIQUE(cliente_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cashback_balance_cliente ON sistemaretiradas.cashback_balance(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_balance_disponivel ON sistemaretiradas.cashback_balance(balance_disponivel) WHERE balance_disponivel > 0;

-- Comentários
COMMENT ON TABLE sistemaretiradas.cashback_balance IS 'Saldos de cashback por cliente';
COMMENT ON COLUMN sistemaretiradas.cashback_balance.balance IS 'Saldo total (disponível + pendente)';
COMMENT ON COLUMN sistemaretiradas.cashback_balance.balance_disponivel IS 'Saldo disponível para uso';
COMMENT ON COLUMN sistemaretiradas.cashback_balance.balance_pendente IS 'Saldo pendente de liberação';
COMMENT ON COLUMN sistemaretiradas.cashback_balance.total_earned IS 'Total acumulado já ganho pelo cliente';

-- ============================================================================
-- 3. TABELA: cashback_transactions
-- Histórico de todas as transações de cashback
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistemaretiradas.cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES sistemaretiradas.tiny_contacts(id) ON DELETE CASCADE,
    tiny_order_id UUID REFERENCES sistemaretiradas.tiny_orders(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTMENT')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    data_liberacao TIMESTAMP WITH TIME ZONE,
    data_expiracao TIMESTAMP WITH TIME ZONE,
    renovado BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_cliente ON sistemaretiradas.cashback_transactions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_order ON sistemaretiradas.cashback_transactions(tiny_order_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_type ON sistemaretiradas.cashback_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_expiracao ON sistemaretiradas.cashback_transactions(data_expiracao) WHERE data_expiracao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_liberacao ON sistemaretiradas.cashback_transactions(data_liberacao) WHERE data_liberacao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_created ON sistemaretiradas.cashback_transactions(created_at DESC);

-- Comentários
COMMENT ON TABLE sistemaretiradas.cashback_transactions IS 'Histórico de transações de cashback';
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.transaction_type IS 'Tipo: EARNED (ganho), REDEEMED (resgatado), EXPIRED (expirado), ADJUSTMENT (ajuste manual)';
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.data_liberacao IS 'Data em que o cashback fica disponível para uso';
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.data_expiracao IS 'Data em que o cashback expira';
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.renovado IS 'Se o cashback foi renovado após expiração';

-- ============================================================================
-- 4. FUNÇÃO: Obter configuração de cashback (global ou por loja)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.get_cashback_settings(p_store_id UUID DEFAULT NULL)
RETURNS sistemaretiradas.cashback_settings
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_settings sistemaretiradas.cashback_settings;
BEGIN
    -- Tentar buscar configuração específica da loja
    IF p_store_id IS NOT NULL THEN
        SELECT * INTO v_settings
        FROM sistemaretiradas.cashback_settings
        WHERE store_id = p_store_id
        LIMIT 1;
    END IF;
    
    -- Se não encontrou configuração específica, buscar global
    IF v_settings IS NULL THEN
        SELECT * INTO v_settings
        FROM sistemaretiradas.cashback_settings
        WHERE store_id IS NULL
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, retornar configuração padrão (em memória)
    IF v_settings IS NULL THEN
        v_settings := (
            NULL, -- id
            NULL, -- store_id
            2,    -- prazo_liberacao_dias
            30,   -- prazo_expiracao_dias
            15.00, -- percentual_cashback
            30.00, -- percentual_uso_maximo
            true,  -- renovacao_habilitada
            3,     -- renovacao_dias
            NULL,  -- observacoes
            NOW(), -- created_at
            NOW()  -- updated_at
        )::sistemaretiradas.cashback_settings;
    END IF;
    
    RETURN v_settings;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_cashback_settings IS 'Retorna configuração de cashback (prioriza loja, depois global, depois padrão)';

-- ============================================================================
-- 5. FUNÇÃO: Gerar cashback para um pedido
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_tiny_order_id UUID,
    p_cliente_id UUID,
    p_store_id UUID,
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

COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 'Gera cashback automaticamente para um pedido';

-- ============================================================================
-- 6. FUNÇÃO: Atualizar saldos de cashback (liberar pendentes)
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.atualizar_saldos_cashback()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER := 0;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Atualizar transações que foram liberadas (data_liberacao <= NOW)
    -- Isso será feito pelo trigger que atualiza os saldos automaticamente
    
    -- Atualizar saldos de todos os clientes com base nas transações
    WITH saldo_calculado AS (
        SELECT
            cliente_id,
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
        balance,
        balance_disponivel,
        balance_pendente,
        total_earned
    )
    SELECT
        cliente_id,
        balance_disponivel + balance_pendente,
        balance_disponivel,
        balance_pendente,
        total_earned
    FROM saldo_calculado
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        balance = EXCLUDED.balance,
        balance_disponivel = EXCLUDED.balance_disponivel,
        balance_pendente = EXCLUDED.balance_pendente,
        total_earned = EXCLUDED.total_earned,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.atualizar_saldos_cashback IS 'Atualiza saldos de cashback baseado nas transações';

-- ============================================================================
-- 7. FUNÇÃO: Renovar cashback expirado
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.renovar_cashback(
    p_transaction_id UUID,
    p_cliente_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_transaction sistemaretiradas.cashback_transactions;
    v_settings sistemaretiradas.cashback_settings;
    v_new_expiration TIMESTAMP WITH TIME ZONE;
    v_store_id UUID;
BEGIN
    -- Buscar transação
    SELECT * INTO v_transaction
    FROM sistemaretiradas.cashback_transactions
    WHERE id = p_transaction_id
      AND cliente_id = p_cliente_id
      AND transaction_type = 'EARNED';
    
    IF v_transaction IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transação não encontrada'
        );
    END IF;
    
    -- Buscar store_id do cliente
    SELECT store_id INTO v_store_id
    FROM sistemaretiradas.tiny_contacts
    WHERE id = p_cliente_id;
    
    -- Obter configurações
    v_settings := sistemaretiradas.get_cashback_settings(v_store_id);
    
    -- Verificar se renovação está habilitada
    IF NOT v_settings.renovacao_habilitada THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Renovação de cashback está desabilitada'
        );
    END IF;
    
    -- Calcular nova data de expiração
    v_new_expiration := NOW() + (v_settings.renovacao_dias || ' days')::INTERVAL;
    
    -- Se já estava expirado e tinha data_liberacao, manter ela
    -- Se não tinha data_liberacao, usar agora
    IF v_transaction.data_liberacao IS NULL THEN
        v_new_expiration := NOW() + (v_settings.renovacao_dias || ' days')::INTERVAL;
    END IF;
    
    -- Atualizar transação
    UPDATE sistemaretiradas.cashback_transactions
    SET
        data_expiracao = v_new_expiration,
        data_liberacao = COALESCE(data_liberacao, NOW()),
        renovado = true,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Atualizar saldos
    PERFORM sistemaretiradas.atualizar_saldos_cashback();
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cashback renovado com sucesso',
        'new_expiration', v_new_expiration
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.renovar_cashback IS 'Renova cashback expirado adicionando dias conforme configuração';

-- ============================================================================
-- 8. TRIGGER: Atualizar saldos automaticamente quando transação é inserida/atualizada
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_atualizar_saldo_cashback()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Atualizar saldos apenas para o cliente específico da transação
    -- Usar uma função mais eficiente que atualiza apenas um cliente
    PERFORM sistemaretiradas.atualizar_saldo_cliente_cashback(COALESCE(NEW.cliente_id, OLD.cliente_id));
    
    RETURN NEW;
END;
$$;

-- Função para atualizar saldo de um cliente específico
CREATE OR REPLACE FUNCTION sistemaretiradas.atualizar_saldo_cliente_cashback(p_cliente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
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
    
    -- Atualizar ou criar saldo
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
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        balance = EXCLUDED.balance,
        balance_disponivel = EXCLUDED.balance_disponivel,
        balance_pendente = EXCLUDED.balance_pendente,
        total_earned = EXCLUDED.total_earned,
        updated_at = NOW();
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_saldo_cashback_insert ON sistemaretiradas.cashback_transactions;
CREATE TRIGGER trg_atualizar_saldo_cashback_insert
    AFTER INSERT ON sistemaretiradas.cashback_transactions
    FOR EACH ROW
    WHEN (NEW.cliente_id IS NOT NULL)
    EXECUTE FUNCTION sistemaretiradas.trigger_atualizar_saldo_cashback();

DROP TRIGGER IF EXISTS trg_atualizar_saldo_cashback_update ON sistemaretiradas.cashback_transactions;
CREATE TRIGGER trg_atualizar_saldo_cashback_update
    AFTER UPDATE ON sistemaretiradas.cashback_transactions
    FOR EACH ROW
    WHEN (NEW.cliente_id IS NOT NULL OR OLD.cliente_id IS NOT NULL)
    EXECUTE FUNCTION sistemaretiradas.trigger_atualizar_saldo_cashback();

-- ============================================================================
-- 9. RLS (Row Level Security)
-- ============================================================================
ALTER TABLE sistemaretiradas.cashback_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.cashback_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.cashback_transactions ENABLE ROW LEVEL SECURITY;

-- Policies para cashback_settings (apenas ADMIN e LOJA podem ver)
DROP POLICY IF EXISTS "Admin e Loja podem ver configurações de cashback" ON sistemaretiradas.cashback_settings;
CREATE POLICY "Admin e Loja podem ver configurações de cashback"
    ON sistemaretiradas.cashback_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

DROP POLICY IF EXISTS "Apenas ADMIN pode criar/editar configurações de cashback" ON sistemaretiradas.cashback_settings;
CREATE POLICY "Apenas ADMIN pode criar/editar configurações de cashback"
    ON sistemaretiradas.cashback_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role = 'ADMIN'
        )
    );

-- Policies para cashback_balance (ADMIN, LOJA e o próprio cliente via contato)
DROP POLICY IF EXISTS "Admin e Loja podem ver todos os saldos" ON sistemaretiradas.cashback_balance;
CREATE POLICY "Admin e Loja podem ver todos os saldos"
    ON sistemaretiradas.cashback_balance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- Policies para cashback_transactions (ADMIN, LOJA podem ver todas)
DROP POLICY IF EXISTS "Admin e Loja podem ver todas as transações" ON sistemaretiradas.cashback_transactions;
CREATE POLICY "Admin e Loja podem ver todas as transações"
    ON sistemaretiradas.cashback_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
            AND role IN ('ADMIN', 'LOJA')
        )
    );

-- ============================================================================
-- 10. CRIAR CONFIGURAÇÃO PADRÃO GLOBAL
-- ============================================================================
INSERT INTO sistemaretiradas.cashback_settings (
    store_id,
    prazo_liberacao_dias,
    prazo_expiracao_dias,
    percentual_cashback,
    percentual_uso_maximo,
    renovacao_habilitada,
    renovacao_dias,
    observacoes
) VALUES (
    NULL, -- Configuração global
    2,
    30,
    15.00,
    30.00,
    true,
    3,
    'Configuração padrão do sistema de cashback'
) ON CONFLICT (store_id) DO NOTHING;


-- ============================================================================
-- 11. TRIGGER: Gerar cashback automaticamente para novos pedidos
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Apenas se tiver cliente e valor > 0 e não for cancelado
    IF NEW.cliente_id IS NOT NULL AND NEW.valor_total > 0 AND (NEW.situacao IS NULL OR NEW.situacao NOT IN ('cancelado', 'Cancelado')) THEN
        -- Tentar gerar cashback (ignorar erros para não travar o insert do pedido)
        BEGIN
            PERFORM sistemaretiradas.gerar_cashback(
                NEW.id,
                NEW.cliente_id,
                NEW.store_id,
                NEW.valor_total
            );
        EXCEPTION WHEN OTHERS THEN
            -- Logar erro mas não falhar a transação do pedido
            RAISE WARNING 'Erro ao gerar cashback para pedido %: %', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_cashback_new_order ON sistemaretiradas.tiny_orders;
CREATE TRIGGER trg_gerar_cashback_new_order
    AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_pedido();

