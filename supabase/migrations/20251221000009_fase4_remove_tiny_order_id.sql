-- =====================================================
-- FASE 4: REMOVER tiny_order_id COMPLETAMENTE
-- =====================================================
-- ATENÇÃO: Execute esta migration APENAS após confirmar que
-- todo o código foi migrado para external_order_id + order_source
-- =====================================================

-- 1. Remover trigger de sincronização (não é mais necessário)
DROP TRIGGER IF EXISTS trg_sync_tiny_order_id_from_external ON sistemaretiradas.sales;
DROP FUNCTION IF EXISTS sistemaretiradas.sync_tiny_order_id_from_external();

-- 2. Remover índices relacionados a tiny_order_id
DROP INDEX IF EXISTS sistemaretiradas.idx_sales_tiny_order_id;
DROP INDEX IF EXISTS sistemaretiradas.idx_sales_tiny_order_id_unique;

-- 3. Remover foreign key constraint (se existir)
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'sales' 
        AND constraint_name LIKE '%tiny_order_id%'
    ) THEN
        -- Buscar nome exato da constraint
        FOR r IN (
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'sistemaretiradas.sales'::regclass
            AND conname LIKE '%tiny_order_id%'
        ) LOOP
            EXECUTE format('ALTER TABLE sistemaretiradas.sales DROP CONSTRAINT IF EXISTS %I', r.conname);
            RAISE NOTICE 'Constraint removida: %', r.conname;
        END LOOP;
    END IF;
END $$;

-- 4. Remover coluna tiny_order_id
ALTER TABLE sistemaretiradas.sales 
DROP COLUMN IF EXISTS tiny_order_id;

-- 5. Atualizar função gerar_cashback para remover parâmetro p_tiny_order_id
CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
    p_external_order_id TEXT DEFAULT NULL,
    p_order_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_cliente_id UUID;
    v_valor_venda NUMERIC(10,2);
    v_data_venda TIMESTAMP WITH TIME ZONE;
    v_colaboradora_id UUID;
    v_config RECORD;
    v_valor_cashback NUMERIC(10,2);
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_transaction_id UUID;
BEGIN
    -- Validar parâmetros
    IF p_sale_id IS NULL AND (p_external_order_id IS NULL OR p_order_source IS NULL) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Deve fornecer p_sale_id OU (p_external_order_id + p_order_source)');
    END IF;

    -- Buscar dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            s.store_id,
            s.cliente_id,
            s.valor,
            s.data_venda,
            s.colaboradora_id,
            s.external_order_id,
            s.order_source
        INTO 
            v_store_id,
            v_cliente_id,
            v_valor_venda,
            v_data_venda,
            v_colaboradora_id,
            p_external_order_id,
            p_order_source
        FROM sistemaretiradas.sales s
        WHERE s.id = p_sale_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Venda não encontrada');
        END IF;
        
    ELSIF p_external_order_id IS NOT NULL AND p_order_source = 'TINY' THEN
        -- Buscar de tiny_orders
        SELECT 
            tor.store_id,
            tor.cliente_id,
            tor.valor_total,
            tor.data_pedido,
            tor.colaboradora_id
        INTO 
            v_store_id,
            v_cliente_id,
            v_valor_venda,
            v_data_venda,
            v_colaboradora_id
        FROM sistemaretiradas.tiny_orders tor
        WHERE tor.id = p_external_order_id::UUID;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Pedido externo não encontrado');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Origem de pedido não suportada ou parâmetros inválidos');
    END IF;

    -- Validar dados essenciais
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado na venda');
    END IF;

    -- Buscar configuração de cashback
    SELECT * INTO v_config
    FROM sistemaretiradas.cashback_settings
    WHERE store_id = v_store_id OR store_id IS NULL
    ORDER BY CASE WHEN store_id IS NULL THEN 1 ELSE 0 END
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Configuração de cashback não encontrada');
    END IF;

    -- Verificar duplicidade
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions
        WHERE (
            (sale_id = p_sale_id AND p_sale_id IS NOT NULL)
            OR (
                external_order_id = p_external_order_id 
                AND order_source = p_order_source
                AND p_external_order_id IS NOT NULL
            )
        )
        AND transaction_type = 'EARNED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cashback já gerado para esta venda');
    END IF;

    -- Calcular valores
    v_valor_cashback := ROUND((v_valor_venda * v_config.percentual_cashback / 100.0), 2);
    v_data_liberacao := v_data_venda + (v_config.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_config.prazo_expiracao_dias || ' days')::INTERVAL;

    -- Inserir transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        sale_id,
        external_order_id,
        order_source,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        v_cliente_id,
        p_sale_id,
        p_external_order_id,
        p_order_source,
        'EARNED',
        v_valor_cashback,
        'Cashback referente à venda ' || COALESCE(p_sale_id::text, p_external_order_id, 'N/A'),
        v_data_liberacao,
        v_data_expiracao
    ) RETURNING id INTO v_transaction_id;

    -- Atualizar saldo
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        balance,
        balance_pendente,
        total_earned
    ) VALUES (
        v_cliente_id,
        v_valor_cashback,
        v_valor_cashback,
        v_valor_cashback
    )
    ON CONFLICT (cliente_id) DO UPDATE SET
        balance = cashback_balance.balance + v_valor_cashback,
        balance_pendente = cashback_balance.balance_pendente + v_valor_cashback,
        total_earned = cashback_balance.total_earned + v_valor_cashback,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'amount', v_valor_cashback,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao
    );
END;
$$;

-- 6. Atualizar trigger de cashback (remover referência a tiny_order_id)
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_venda()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cliente_id IS NOT NULL THEN
        PERFORM sistemaretiradas.gerar_cashback(
            p_sale_id := NEW.id,
            p_external_order_id := NEW.external_order_id,
            p_order_source := NEW.order_source
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao gerar cashback para venda %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários finais
COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 
'Gera cashback para uma venda. Aceita p_sale_id OU (p_external_order_id + p_order_source). Suporta múltiplos ERPs.';

-- 8. Nota importante
DO $$
BEGIN
    RAISE NOTICE '✅ FASE 4 CONCLUÍDA: Coluna tiny_order_id foi removida completamente.';
    RAISE NOTICE '   Sistema agora usa exclusivamente external_order_id + order_source.';
    RAISE NOTICE '   Suporte para múltiplos ERPs está 100% funcional.';
END $$;

