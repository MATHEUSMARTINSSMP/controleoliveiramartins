-- ============================================================================
-- MIGRATION: Corrigir todos os ON CONFLICT para usar nome da constraint
-- Data: 2025-01-28
-- Descrição: Corrige todos os ON CONFLICT para usar ON CONSTRAINT explicitamente
--            Resolve erro 42P10 em todos os lugares
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR FUNÇÃO: atualizar_saldos_cashback
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.atualizar_saldos_cashback()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated INTEGER := 0;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
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
    ON CONFLICT ON CONSTRAINT cashback_balance_unique_cliente DO UPDATE
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

