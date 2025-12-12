-- ============================================================================
-- MIGRATION: Fix Cashback Queue Constraints
-- Data: 2025-12-12
-- Descrição: Remove restrição de FK em cliente_id na tabela de fila para permitir
--            clientes do CRM. Atualiza função de enqueue.
-- ============================================================================

-- 1. Remover FK estrita de cliente_id na tabela de fila
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_whatsapp_queue_cliente_id_fkey'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue
        DROP CONSTRAINT cashback_whatsapp_queue_cliente_id_fkey;
    END IF;
END $$;

-- 2. Atualizar função enqueue_cashback_whatsapp para ser mais flexível
CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_transaction_id UUID,
    p_cliente_id UUID,
    p_store_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    -- Verificar se já existe na fila para esta transação
    SELECT id INTO v_queue_id
    FROM sistemaretiradas.cashback_whatsapp_queue
    WHERE transaction_id = p_transaction_id
    LIMIT 1;
    
    IF v_queue_id IS NOT NULL THEN
        -- Já existe, retornar ID existente
        RETURN v_queue_id;
    END IF;
    
    -- Criar nova entrada na fila
    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        transaction_id,
        cliente_id,
        store_id,
        status
    ) VALUES (
        p_transaction_id,
        p_cliente_id,
        p_store_id,
        'PENDING'
    )
    RETURNING id INTO v_queue_id;
    
    RAISE NOTICE '✅ WhatsApp de cashback adicionado à fila (ID: %)', v_queue_id;
    
    RETURN v_queue_id;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao adicionar WhatsApp à fila (não bloqueia geração): %', SQLERRM;
    RETURN NULL;
END;
$$;

-- 3. Atualizar função gerar_cashback para chamar o enqueue (garantir que está chamando)
-- A versão anterior (20251212000003) já deveria ter isso, mas vamos reforçar
-- adicionando a chamada ao enqueue se ela não existir na versão anterior.
-- Na verdade, a versão anterior NÃO tinha a chamada ao enqueue explicitamente.
-- Vamos atualizar a gerar_cashback novamente para incluir o enqueue.

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
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
    v_config RECORD;
    v_valor_cashback NUMERIC(10,2);
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_transaction_id UUID;
    v_queue_id UUID;
BEGIN
    -- Identificar origem e dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            store_id, 
            cliente_id, 
            valor, 
            data_venda,
            tiny_order_id
        INTO 
            v_store_id, 
            v_cliente_id, 
            v_valor_venda, 
            v_data_venda,
            p_tiny_order_id
        FROM sistemaretiradas.sales
        WHERE id = p_sale_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Venda não encontrada');
        END IF;
    ELSIF p_tiny_order_id IS NOT NULL THEN
        SELECT 
            store_id, 
            cliente_id, 
            valor_total, 
            data_pedido
        INTO 
            v_store_id, 
            v_cliente_id, 
            v_valor_venda, 
            v_data_venda
        FROM sistemaretiradas.tiny_orders
        WHERE id = p_tiny_order_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Pedido Tiny não encontrado');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'ID da venda ou pedido não fornecido');
    END IF;

    -- Validar dados essenciais
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Venda sem cliente identificado');
    END IF;

    IF v_valor_venda <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Valor da venda inválido');
    END IF;

    -- Buscar configurações
    SELECT * INTO v_config
    FROM sistemaretiradas.cashback_settings
    WHERE store_id = v_store_id;

    IF NOT FOUND THEN
        SELECT * INTO v_config
        FROM sistemaretiradas.cashback_settings
        WHERE store_id IS NULL;
    END IF;

    IF v_config IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Configuração de cashback não encontrada');
    END IF;

    -- Verificar duplicidade
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions
        WHERE (sale_id = p_sale_id AND p_sale_id IS NOT NULL)
           OR (tiny_order_id = p_tiny_order_id AND p_tiny_order_id IS NOT NULL)
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
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        v_cliente_id,
        p_sale_id,
        p_tiny_order_id,
        'EARNED',
        v_valor_cashback,
        'Cashback referente à venda ' || COALESCE(p_sale_id::text, p_tiny_order_id::text),
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
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        balance = cashback_balance.balance + EXCLUDED.balance,
        balance_pendente = cashback_balance.balance_pendente + EXCLUDED.balance_pendente,
        total_earned = cashback_balance.total_earned + EXCLUDED.total_earned,
        updated_at = NOW();

    -- ✅ ADICIONAR À FILA DE WHATSAPP
    BEGIN
        v_queue_id := sistemaretiradas.enqueue_cashback_whatsapp(
            v_transaction_id,
            v_cliente_id,
            v_store_id
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao enfileirar WhatsApp: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Cashback gerado com sucesso',
        'valor', v_valor_cashback,
        'whatsapp_queue_id', v_queue_id
    );
END;
$$;
