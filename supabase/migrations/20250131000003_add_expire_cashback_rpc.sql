-- MIGRATION: Adicionar RPC para expirar cashback vencido com lógica robusta
-- Data: 2025-01-31

CREATE OR REPLACE FUNCTION sistemaretiradas.expirar_cashback_vencido()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_cliente RECORD;
    v_saldo_teorico NUMERIC(10,2);
    v_saldo_real NUMERIC(10,2);
    v_ja_expirado NUMERIC(10,2);
    v_diff NUMERIC(10,2);
    v_total_expirado INTEGER := 0;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Iterar por todos os clientes que têm saldo
    FOR v_cliente IN 
        SELECT DISTINCT cliente_id FROM sistemaretiradas.cashback_transactions
    LOOP
        -- 1. Calcular Saldo Teórico (Tudo que ganhou - Tudo que gastou, ignorando datas de expiração)
        -- Considera apenas o que já foi liberado (data_liberacao <= now)
        SELECT 
            COALESCE(SUM(CASE WHEN transaction_type = 'EARNED' AND (data_liberacao IS NULL OR data_liberacao <= v_now) THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN transaction_type = 'REDEEMED' THEN amount ELSE 0 END), 0)
        INTO v_saldo_teorico
        FROM sistemaretiradas.cashback_transactions
        WHERE cliente_id = v_cliente.cliente_id;

        -- 2. Calcular Saldo Real (O que realmente está válido hoje)
        -- A lógica do saldo real já exclui os expirados via data_expiracao
        SELECT 
            COALESCE(SUM(CASE 
                WHEN transaction_type = 'EARNED' 
                    AND (data_liberacao IS NULL OR data_liberacao <= v_now) 
                    AND (data_expiracao IS NULL OR data_expiracao > v_now)
                THEN amount 
                ELSE 0 
            END), 0) -
            COALESCE(SUM(CASE WHEN transaction_type = 'REDEEMED' THEN amount ELSE 0 END), 0)
        INTO v_saldo_real
        FROM sistemaretiradas.cashback_transactions
        WHERE cliente_id = v_cliente.cliente_id;

        -- Garantir não negativos
        v_saldo_teorico := GREATEST(v_saldo_teorico, 0);
        v_saldo_real := GREATEST(v_saldo_real, 0);

        -- 3. Quanto deveria ter sido registrado como expirado?
        -- Se Teórico (100) > Real (80), significa que 20 expiraram.
        v_diff := v_saldo_teorico - v_saldo_real;

        IF v_diff > 0 THEN
            -- 4. Quanto JÁ FOI registrado como expirado?
            SELECT COALESCE(SUM(amount), 0)
            INTO v_ja_expirado
            FROM sistemaretiradas.cashback_transactions
            WHERE cliente_id = v_cliente.cliente_id
              AND transaction_type = 'EXPIRED';

            -- 5. A diferença é o que precisamos registrar AGORA
            -- Ex: Deveria ter expirado 20, mas só registramos 5. Precisamos registrar +15.
            v_diff := v_diff - v_ja_expirado;

            IF v_diff > 0.01 THEN -- Margem de erro para float
                INSERT INTO sistemaretiradas.cashback_transactions (
                    cliente_id,
                    transaction_type,
                    amount,
                    description,
                    created_at
                ) VALUES (
                    v_cliente.cliente_id,
                    'EXPIRED',
                    v_diff,
                    'Expiração automática de saldo vencido',
                    NOW()
                );
                
                v_total_expirado := v_total_expirado + 1;
                
                -- O trigger da tabela transactions vai atualizar o saldo automaticamente,
                -- mas como 'EXPIRED' não entra no cálculo do saldo disponível (apenas REDEEMED entra),
                -- o saldo real não muda. O registro é apenas para histórico/audit.
                -- O saldo real já caiu "sozinho" quando a data passou.
            END IF;
        END IF;
    END LOOP;

    -- Forçar atualização de saldos para garantir consistência
    PERFORM sistemaretiradas.atualizar_saldos_cashback();

    RETURN v_total_expirado;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.expirar_cashback_vencido IS 'Calcula e registra expiração de cashback baseado na diferença entre saldo teórico e real';
