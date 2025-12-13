-- ============================================================================
-- CORREÇÃO: Função gerar_cashback deve usar cashback_settings (não cashback_config)
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
    p_tiny_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id UUID;
    v_cliente_nome TEXT;
    v_cliente_telefone TEXT;
    v_valor_venda NUMERIC;
    v_percentual_cashback NUMERIC;
    v_valor_cashback NUMERIC;
    v_colaboradora_id UUID;
    v_store_id UUID;
    v_transaction_id UUID;
    v_saldo_anterior NUMERIC;
    v_saldo_novo NUMERIC;
BEGIN
    -- Buscar dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            COALESCE(s.cliente_id, s.tiny_contact_id),
            COALESCE(s.cliente_nome, tc.nome),
            COALESCE(s.cliente_telefone, tc.telefone),
            s.valor,
            s.colaboradora_id,
            s.store_id
        INTO 
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_venda,
            v_colaboradora_id,
            v_store_id
        FROM sistemaretiradas.sales s
        LEFT JOIN sistemaretiradas.tiny_contacts tc ON tc.id = s.tiny_contact_id
        WHERE s.id = p_sale_id;
    ELSIF p_tiny_order_id IS NOT NULL THEN
        SELECT 
            tor.cliente_id,
            tc.nome,
            tc.telefone,
            tor.valor_total,
            tor.colaboradora_id,
            tor.store_id
        INTO 
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_venda,
            v_colaboradora_id,
            v_store_id
        FROM sistemaretiradas.tiny_orders tor
        LEFT JOIN sistemaretiradas.tiny_contacts tc ON tc.id = tor.cliente_id
        WHERE tor.id = p_tiny_order_id;
    ELSE
        RAISE EXCEPTION 'Deve fornecer p_sale_id ou p_tiny_order_id';
    END IF;

    -- Verificar se encontrou a venda
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente não encontrado'
        );
    END IF;

    -- CORREÇÃO: Buscar percentual de cashback da tabela cashback_settings (por store_id)
    SELECT COALESCE(percentual_cashback, 15) INTO v_percentual_cashback
    FROM sistemaretiradas.cashback_settings
    WHERE store_id = v_store_id
    LIMIT 1;
    
    -- Se não encontrou configuração para a loja, usar 15% padrão
    IF v_percentual_cashback IS NULL THEN
        v_percentual_cashback := 15;
    END IF;

    -- Calcular cashback (arredondar para cima)
    v_valor_cashback := CEIL((v_valor_venda * v_percentual_cashback / 100));

    -- Inserir transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tipo,
        valor,
        saldo_anterior,
        saldo_novo,
        descricao,
        tiny_order_id,
        sale_id,
        colaboradora_id,
        store_id
    ) VALUES (
        v_cliente_id,
        'CREDITO',
        v_valor_cashback,
        0,
        0,
        'Cashback de compra',
        p_tiny_order_id,
        p_sale_id,
        v_colaboradora_id,
        v_store_id
    ) RETURNING id INTO v_transaction_id;

    -- Atualizar ou criar saldo
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        saldo_disponivel,
        saldo_utilizado,
        colaboradora_id,
        store_id
    ) VALUES (
        v_cliente_id,
        v_valor_cashback,
        0,
        v_colaboradora_id,
        v_store_id
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET 
        saldo_disponivel = sistemaretiradas.cashback_balance.saldo_disponivel + v_valor_cashback,
        updated_at = NOW()
    RETURNING 
        saldo_disponivel - v_valor_cashback,
        saldo_disponivel
    INTO v_saldo_anterior, v_saldo_novo;

    -- Atualizar transação com saldos corretos
    UPDATE sistemaretiradas.cashback_transactions
    SET 
        saldo_anterior = v_saldo_anterior,
        saldo_novo = v_saldo_novo
    WHERE id = v_transaction_id;

    -- Enfileirar WhatsApp
    PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
        v_cliente_id,
        v_cliente_nome,
        v_cliente_telefone,
        v_valor_cashback,
        v_saldo_novo
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'valor_cashback', v_valor_cashback,
        'saldo_novo', v_saldo_novo
    );
END;
$$;

-- Verificação
DO $$
BEGIN
    RAISE NOTICE '✅ Função gerar_cashback atualizada!';
    RAISE NOTICE '   - Agora usa tabela cashback_settings';
    RAISE NOTICE '   - Busca configuração por store_id';
    RAISE NOTICE '   - Padrão: 15%% de cashback';
END $$;
