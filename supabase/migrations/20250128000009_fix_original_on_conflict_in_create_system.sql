-- ============================================================================
-- MIGRATION: Corrigir ON CONFLICT na função atualizar_saldo_cliente_cashback original
-- Data: 2025-01-28
-- Descrição: Atualiza a função da migration original para usar constraint explicitamente
--            Isso garante compatibilidade caso a migration original seja re-executada
-- ============================================================================

-- ============================================================================
-- CORRIGIR FUNÇÃO: atualizar_saldo_cliente_cashback
-- Esta é a versão que está na migration 20250128000000_create_cashback_system.sql
-- Vamos atualizá-la para usar ON CONSTRAINT explicitamente
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
    -- ✅ CORRIGIDO: Usar nome da constraint explicitamente
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

