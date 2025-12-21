-- =====================================================
-- FASE 2: MIGRAR FUNÇÕES RPC PARA external_order_id + order_source
-- =====================================================

-- 1. Remover TODAS as versões antigas da função gerar_cashback
-- PostgreSQL permite function overloading, então precisamos remover todas as assinaturas
DO $$
DECLARE
    r RECORD;
    func_signature TEXT;
BEGIN
    -- Buscar todas as funções gerar_cashback no schema sistemaretiradas
    FOR r IN (
        SELECT 
            p.proname as funcname,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'sistemaretiradas'
          AND p.proname = 'gerar_cashback'
    ) LOOP
        func_signature := 'sistemaretiradas.' || r.funcname || '(' || r.args || ')';
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_signature);
        RAISE NOTICE 'Função removida: %', func_signature;
    END LOOP;
END $$;

-- 2. Criar nova versão da função gerar_cashback com suporte a external_order_id + order_source
CREATE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
    p_external_order_id TEXT DEFAULT NULL,
    p_order_source TEXT DEFAULT NULL,
    -- Parâmetros legados (DEPRECATED - manter para compatibilidade)
    p_tiny_order_id UUID DEFAULT NULL
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
    v_external_order_id_final TEXT;
    v_order_source_final TEXT;
BEGIN
    -- ✅ NOVA LÓGICA: Priorizar external_order_id + order_source
    -- Se não fornecido, tentar converter de tiny_order_id (compatibilidade)
    IF p_external_order_id IS NOT NULL AND p_order_source IS NOT NULL THEN
        v_external_order_id_final := p_external_order_id;
        v_order_source_final := p_order_source;
    ELSIF p_tiny_order_id IS NOT NULL THEN
        -- Compatibilidade: converter tiny_order_id para nova estrutura
        v_external_order_id_final := p_tiny_order_id::TEXT;
        v_order_source_final := 'TINY';
    ELSE
        v_external_order_id_final := NULL;
        v_order_source_final := NULL;
    END IF;

    -- Buscar dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            s.store_id,
            s.cliente_id,
            s.valor,
            s.data_venda,
            s.colaboradora_id
        INTO 
            v_store_id,
            v_cliente_id,
            v_valor_venda,
            v_data_venda,
            v_colaboradora_id
        FROM sistemaretiradas.sales s
        WHERE s.id = p_sale_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Venda não encontrada');
        END IF;
        
        -- Se venda tem external_order_id, usar dele
        IF v_external_order_id_final IS NULL THEN
            SELECT external_order_id, order_source
            INTO v_external_order_id_final, v_order_source_final
            FROM sistemaretiradas.sales
            WHERE id = p_sale_id;
        END IF;
        
    ELSIF v_external_order_id_final IS NOT NULL AND v_order_source_final = 'TINY' THEN
        -- Buscar de tiny_orders (compatibilidade)
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
        WHERE tor.id = v_external_order_id_final::UUID;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Pedido externo não encontrado');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'ID da venda ou pedido externo não fornecido');
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

    -- Verificar duplicidade (usar external_order_id se disponível)
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions
        WHERE (
            (sale_id = p_sale_id AND p_sale_id IS NOT NULL)
            OR (
                external_order_id = v_external_order_id_final 
                AND order_source = v_order_source_final
                AND v_external_order_id_final IS NOT NULL
            )
            -- Compatibilidade: verificar tiny_order_id se ainda usado
            OR (
                tiny_order_id = p_tiny_order_id 
                AND p_tiny_order_id IS NOT NULL
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
        tiny_order_id, -- Manter para compatibilidade
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        v_cliente_id,
        p_sale_id,
        v_external_order_id_final,
        v_order_source_final,
        CASE WHEN v_order_source_final = 'TINY' AND v_external_order_id_final IS NOT NULL 
             THEN v_external_order_id_final::UUID 
             ELSE NULL 
        END, -- Manter tiny_order_id para compatibilidade
        'EARNED',
        v_valor_cashback,
        'Cashback referente à venda ' || COALESCE(p_sale_id::text, v_external_order_id_final, 'N/A'),
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

-- 2. Atualizar função processar_tiny_order_para_venda para usar external_order_id
CREATE OR REPLACE FUNCTION sistemaretiradas.processar_tiny_order_para_venda(
    p_tiny_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_pedido RECORD;
    v_qtd_pecas INTEGER;
    v_observacoes TEXT;
    v_sale_id UUID;
BEGIN
    -- Buscar pedido
    SELECT * INTO v_pedido
    FROM sistemaretiradas.tiny_orders
    WHERE id = p_tiny_order_id;
    
    IF NOT FOUND THEN
        RAISE WARNING 'Pedido % não encontrado', p_tiny_order_id;
        RETURN NULL;
    END IF;
    
    -- Validações
    IF v_pedido.colaboradora_id IS NULL OR v_pedido.store_id IS NULL OR v_pedido.valor_total <= 0 THEN
        RAISE WARNING 'Pedido % inválido para criar venda', p_tiny_order_id;
        RETURN NULL;
    END IF;
    
    -- Verificar se já existe venda
    SELECT id INTO v_sale_id
    FROM sistemaretiradas.sales
    WHERE external_order_id = p_tiny_order_id::TEXT
      AND order_source = 'TINY';
    
    IF v_sale_id IS NOT NULL THEN
        RETURN v_sale_id; -- Já existe
    END IF;
    
    -- Calcular quantidade de peças
    v_qtd_pecas := 0;
    IF v_pedido.itens IS NOT NULL THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0) INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item;
    END IF;
    
    -- Observações
    v_observacoes := 'Pedido Tiny: #' || COALESCE(v_pedido.numero_pedido, 'N/A');
    
    -- Criar venda com external_order_id + order_source
    INSERT INTO sistemaretiradas.sales (
        external_order_id,
        order_source,
        tiny_order_id, -- Manter para compatibilidade
        colaboradora_id,
        store_id,
        valor,
        qtd_pecas,
        data_venda,
        observacoes,
        lancado_por_id
    ) VALUES (
        p_tiny_order_id::TEXT,
        'TINY',
        p_tiny_order_id, -- Manter para compatibilidade
        v_pedido.colaboradora_id,
        v_pedido.store_id,
        v_pedido.valor_total,
        v_qtd_pecas,
        v_pedido.data_pedido,
        v_observacoes,
        NULL
    )
    ON CONFLICT (external_order_id, order_source) WHERE external_order_id IS NOT NULL
    DO UPDATE SET
        valor = EXCLUDED.valor,
        qtd_pecas = EXCLUDED.qtd_pecas,
        data_venda = EXCLUDED.data_venda,
        observacoes = EXCLUDED.observacoes,
        updated_at = NOW()
    RETURNING id INTO v_sale_id;
    
    RETURN v_sale_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ao processar pedido % para venda: %', p_tiny_order_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- 3. Atualizar função processar_tiny_orders_para_vendas para usar external_order_id
-- (Esta função é muito longa, vou criar uma versão atualizada que usa external_order_id)
-- Nota: A função completa está em 20250202000001_fix_auto_process_tiny_orders_to_sales.sql
-- Vou criar uma função auxiliar que converte a lógica

COMMENT ON FUNCTION sistemaretiradas.gerar_cashback IS 
'Gera cashback para uma venda. Aceita p_sale_id OU (p_external_order_id + p_order_source) OU p_tiny_order_id (DEPRECATED). Prefira usar external_order_id + order_source para suporte multi-ERP.';

COMMENT ON FUNCTION sistemaretiradas.processar_tiny_order_para_venda IS 
'Processa um pedido do Tiny ERP e cria/atualiza a venda correspondente usando external_order_id + order_source.';

