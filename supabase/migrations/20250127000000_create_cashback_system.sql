-- =============================================================================
-- SISTEMA DE CASHBACK - SANDBOX (APENAS ADMIN)
-- =============================================================================
-- Este sistema permite que colaboradoras ganhem cashback em vendas
-- e resgatem créditos. Acessível apenas ao admin para testes e configuração.
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. TABELA: cashback_balance
-- =============================================================================
-- Armazena o saldo atual de cashback de cada colaboradora
CREATE TABLE IF NOT EXISTS cashback_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
    total_earned DECIMAL(10,2) DEFAULT 0 CHECK (total_earned >= 0),
    total_redeemed DECIMAL(10,2) DEFAULT 0 CHECK (total_redeemed >= 0),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(colaboradora_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_balance_colaboradora ON cashback_balance(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_cashback_balance_updated ON cashback_balance(updated_at);

-- Comentários
COMMENT ON TABLE cashback_balance IS 'Saldo atual de cashback por colaboradora';
COMMENT ON COLUMN cashback_balance.balance IS 'Saldo disponível para resgate';
COMMENT ON COLUMN cashback_balance.total_earned IS 'Total acumulado de cashback ganho';
COMMENT ON COLUMN cashback_balance.total_redeemed IS 'Total de cashback resgatado';

-- =============================================================================
-- 2. TABELA: cashback_transactions
-- =============================================================================
-- Histórico completo de todas as transações de cashback
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL, -- Venda que gerou cashback (se aplicável)
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTMENT')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    cashback_rule_id UUID, -- Referência à regra aplicada (se aplicável)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_colaboradora ON cashback_transactions(colaboradora_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_sale ON cashback_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_type ON cashback_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_created ON cashback_transactions(created_at DESC);

-- Comentários
COMMENT ON TABLE cashback_transactions IS 'Histórico de transações de cashback';
COMMENT ON COLUMN cashback_transactions.transaction_type IS 'Tipo: EARNED (ganho), REDEEMED (resgatado), EXPIRED (expirado), ADJUSTMENT (ajuste manual)';

-- =============================================================================
-- 3. TABELA: cashback_rules
-- =============================================================================
-- Regras configuráveis de cashback (percentual, limites, validade)
CREATE TABLE IF NOT EXISTS cashback_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100), -- Ex: 2.5 = 2.5%
    min_purchase_value DECIMAL(10,2) DEFAULT 0 CHECK (min_purchase_value >= 0), -- Valor mínimo da compra
    max_cashback_per_transaction DECIMAL(10,2), -- Limite máximo por transação (NULL = sem limite)
    valid_from DATE,
    valid_until DATE,
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Prioridade da regra (maior número = maior prioridade)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_rules_active ON cashback_rules(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_cashback_rules_dates ON cashback_rules(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_cashback_rules_priority ON cashback_rules(priority DESC);

-- Comentários
COMMENT ON TABLE cashback_rules IS 'Regras configuráveis de cashback';
COMMENT ON COLUMN cashback_rules.percentage IS 'Percentual de cashback (ex: 2.5 = 2.5%)';
COMMENT ON COLUMN cashback_rules.priority IS 'Prioridade da regra (maior número = maior prioridade)';

-- =============================================================================
-- 4. FUNÇÃO: calculate_cashback_for_sale
-- =============================================================================
-- Calcula e aplica cashback automaticamente quando uma venda é criada
CREATE OR REPLACE FUNCTION calculate_cashback_for_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_cashback_amount DECIMAL(10,2) := 0;
    v_rule cashback_rules%ROWTYPE;
    v_balance_id UUID;
    v_current_balance DECIMAL(10,2);
BEGIN
    -- Buscar regra ativa mais prioritária que se aplica a esta venda
    SELECT * INTO v_rule
    FROM cashback_rules
    WHERE active = true
        AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
        AND (min_purchase_value IS NULL OR min_purchase_value <= NEW.valor)
    ORDER BY priority DESC, created_at DESC
    LIMIT 1;

    -- Se não houver regra ativa, não calcula cashback
    IF v_rule IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular cashback
    v_cashback_amount := (NEW.valor * v_rule.percentage / 100);

    -- Aplicar limite máximo por transação (se existir)
    IF v_rule.max_cashback_per_transaction IS NOT NULL AND v_cashback_amount > v_rule.max_cashback_per_transaction THEN
        v_cashback_amount := v_rule.max_cashback_per_transaction;
    END IF;

    -- Se o cashback for zero ou negativo, não faz nada
    IF v_cashback_amount <= 0 THEN
        RETURN NEW;
    END IF;

    -- Inserir ou atualizar saldo da colaboradora
    INSERT INTO cashback_balance (colaboradora_id, balance, total_earned)
    VALUES (NEW.colaboradora_id, v_cashback_amount, v_cashback_amount)
    ON CONFLICT (colaboradora_id) DO UPDATE
    SET 
        balance = cashback_balance.balance + v_cashback_amount,
        total_earned = cashback_balance.total_earned + v_cashback_amount,
        updated_at = NOW()
    RETURNING id INTO v_balance_id;

    -- Registrar transação
    INSERT INTO cashback_transactions (
        colaboradora_id,
        sale_id,
        transaction_type,
        amount,
        description,
        cashback_rule_id
    ) VALUES (
        NEW.colaboradora_id,
        NEW.id,
        'EARNED',
        v_cashback_amount,
        'Cashback de ' || v_rule.percentage || '% sobre venda de R$ ' || NEW.valor,
        v_rule.id
    );

    RETURN NEW;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION calculate_cashback_for_sale() IS 'Calcula e aplica cashback automaticamente quando uma venda é criada';

-- =============================================================================
-- 5. TRIGGER: trigger_calculate_cashback
-- =============================================================================
-- Dispara o cálculo de cashback automaticamente após inserir venda
DROP TRIGGER IF EXISTS trigger_calculate_cashback ON sales;
CREATE TRIGGER trigger_calculate_cashback
    AFTER INSERT ON sales
    FOR EACH ROW
    WHEN (NEW.valor > 0)
    EXECUTE FUNCTION calculate_cashback_for_sale();

-- =============================================================================
-- 6. FUNÇÃO RPC: get_cashback_balance
-- =============================================================================
-- Retorna o saldo de cashback de uma colaboradora
CREATE OR REPLACE FUNCTION get_cashback_balance(p_colaboradora_id UUID)
RETURNS TABLE (
    balance DECIMAL(10,2),
    total_earned DECIMAL(10,2),
    total_redeemed DECIMAL(10,2),
    updated_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(cb.balance, 0)::DECIMAL(10,2),
        COALESCE(cb.total_earned, 0)::DECIMAL(10,2),
        COALESCE(cb.total_redeemed, 0)::DECIMAL(10,2),
        COALESCE(cb.updated_at, NOW())::TIMESTAMP
    FROM cashback_balance cb
    WHERE cb.colaboradora_id = p_colaboradora_id;
    
    -- Se não houver registro, retorna zeros
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(10,2), 0::DECIMAL(10,2), NOW()::TIMESTAMP;
    END IF;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION get_cashback_balance(UUID) IS 'Retorna o saldo de cashback de uma colaboradora';

-- =============================================================================
-- 7. FUNÇÃO RPC: get_cashback_transactions
-- =============================================================================
-- Retorna o histórico de transações de cashback de uma colaboradora
CREATE OR REPLACE FUNCTION get_cashback_transactions(
    p_colaboradora_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    transaction_type TEXT,
    amount DECIMAL(10,2),
    description TEXT,
    sale_id UUID,
    created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id,
        ct.transaction_type,
        ct.amount,
        ct.description,
        ct.sale_id,
        ct.created_at
    FROM cashback_transactions ct
    WHERE ct.colaboradora_id = p_colaboradora_id
    ORDER BY ct.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION get_cashback_transactions(UUID, INTEGER, INTEGER) IS 'Retorna o histórico de transações de cashback';

-- =============================================================================
-- 8. FUNÇÃO RPC: redeem_cashback
-- =============================================================================
-- Permite resgatar cashback (admin pode usar para ajustes)
CREATE OR REPLACE FUNCTION redeem_cashback(
    p_colaboradora_id UUID,
    p_amount DECIMAL(10,2),
    p_description TEXT DEFAULT 'Resgate de cashback'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_result JSON;
BEGIN
    -- Validar valor
    IF p_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Valor deve ser maior que zero'
        );
    END IF;

    -- Buscar saldo atual
    SELECT balance INTO v_current_balance
    FROM cashback_balance
    WHERE colaboradora_id = p_colaboradora_id;

    -- Se não houver registro, criar com saldo zero
    IF v_current_balance IS NULL THEN
        INSERT INTO cashback_balance (colaboradora_id, balance)
        VALUES (p_colaboradora_id, 0)
        RETURNING balance INTO v_current_balance;
    END IF;

    -- Verificar se há saldo suficiente
    IF v_current_balance < p_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Saldo insuficiente. Saldo disponível: R$ ' || v_current_balance
        );
    END IF;

    -- Atualizar saldo
    UPDATE cashback_balance
    SET 
        balance = balance - p_amount,
        total_redeemed = total_redeemed + p_amount,
        updated_at = NOW()
    WHERE colaboradora_id = p_colaboradora_id;

    -- Registrar transação
    INSERT INTO cashback_transactions (
        colaboradora_id,
        transaction_type,
        amount,
        description
    ) VALUES (
        p_colaboradora_id,
        'REDEEMED',
        p_amount,
        p_description
    );

    RETURN json_build_object(
        'success', true,
        'new_balance', v_current_balance - p_amount,
        'message', 'Cashback resgatado com sucesso'
    );
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION redeem_cashback(UUID, DECIMAL, TEXT) IS 'Permite resgatar cashback de uma colaboradora';

-- =============================================================================
-- 9. RLS (Row Level Security)
-- =============================================================================
-- Apenas ADMIN pode acessar e gerenciar cashback (sandbox)

-- Habilitar RLS
ALTER TABLE cashback_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_rules ENABLE ROW LEVEL SECURITY;

-- Política: Apenas ADMIN pode ver tudo
CREATE POLICY "admin_cashback_balance_all" ON cashback_balance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "admin_cashback_transactions_all" ON cashback_transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "admin_cashback_rules_all" ON cashback_rules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- =============================================================================
-- 10. DADOS INICIAIS (Regra padrão de exemplo)
-- =============================================================================
-- Inserir uma regra padrão de exemplo (2% de cashback)
INSERT INTO cashback_rules (name, description, percentage, min_purchase_value, active, priority)
VALUES (
    'Cashback Padrão',
    'Regra padrão de cashback: 2% sobre todas as vendas',
    2.00,
    0,
    true,
    1
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

