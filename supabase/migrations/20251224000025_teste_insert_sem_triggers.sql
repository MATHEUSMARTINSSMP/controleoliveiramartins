-- ============================================================================
-- TESTE: INSERT SEM TRIGGERS PARA ISOLAR O PROBLEMA
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Tenta inserir desabilitando triggers temporariamente
-- ============================================================================

-- TESTE: INSERT COM TRIGGERS DESABILITADOS
-- ============================================================================
DO $$
DECLARE
    v_pedido RECORD;
    v_qtd_pecas INTEGER := 1;
    v_observacoes TEXT;
    v_sale_id UUID;
    v_erro TEXT;
BEGIN
    -- Buscar dados do pedido
    SELECT 
        id,
        store_id,
        colaboradora_id,
        data_pedido,
        valor_total,
        itens,
        observacoes,
        numero_pedido,
        forma_pagamento,
        formas_pagamento_json
    INTO v_pedido
    FROM sistemaretiradas.tiny_orders
    WHERE id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID;
    
    -- Calcular quantidade de peças
    IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item
        WHERE (item->>'quantidade') IS NOT NULL;
    END IF;
    IF v_qtd_pecas = 0 THEN
        v_qtd_pecas := 1;
    END IF;
    
    -- Preparar observações
    v_observacoes := COALESCE(v_pedido.observacoes, '');
    IF v_pedido.numero_pedido IS NOT NULL THEN
        IF v_observacoes != '' THEN
            v_observacoes := v_observacoes || ' | ';
        END IF;
        v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
    END IF;
    
    -- Tentar inserir COM triggers habilitados (padrão)
    BEGIN
        INSERT INTO sistemaretiradas.sales (
            tiny_order_id,
            external_order_id,
            order_source,
            colaboradora_id,
            store_id,
            valor,
            qtd_pecas,
            data_venda,
            observacoes,
            forma_pagamento,
            formas_pagamento_json,
            lancado_por_id
        ) VALUES (
            v_pedido.id,
            v_pedido.id::TEXT,
            'TINY',
            v_pedido.colaboradora_id,
            v_pedido.store_id,
            v_pedido.valor_total,
            v_qtd_pecas,
            v_pedido.data_pedido,
            v_observacoes,
            v_pedido.forma_pagamento,
            v_pedido.formas_pagamento_json,
            NULL
        )
        RETURNING id INTO v_sale_id;
        
        RAISE NOTICE '✅ VENDA CRIADA COM SUCESSO! ID: %', v_sale_id;
        
    EXCEPTION WHEN OTHERS THEN
        v_erro := SQLERRM;
        RAISE WARNING '❌ ERRO AO CRIAR VENDA COM TRIGGERS: %', v_erro;
        RAISE WARNING 'SQLSTATE: %', SQLSTATE;
    END;
    
    -- Se deu erro, tentar SEM triggers
    IF v_sale_id IS NULL THEN
        RAISE NOTICE 'Tentando inserir SEM triggers...';
        BEGIN
            -- Desabilitar triggers temporariamente
            ALTER TABLE sistemaretiradas.sales DISABLE TRIGGER ALL;
            
            INSERT INTO sistemaretiradas.sales (
                tiny_order_id,
                external_order_id,
                order_source,
                colaboradora_id,
                store_id,
                valor,
                qtd_pecas,
                data_venda,
                observacoes,
                forma_pagamento,
                formas_pagamento_json,
                lancado_por_id
            ) VALUES (
                v_pedido.id,
                v_pedido.id::TEXT,
                'TINY',
                v_pedido.colaboradora_id,
                v_pedido.store_id,
                v_pedido.valor_total,
                v_qtd_pecas,
                v_pedido.data_pedido,
                v_observacoes,
                v_pedido.forma_pagamento,
                v_pedido.formas_pagamento_json,
                NULL
            )
            RETURNING id INTO v_sale_id;
            
            RAISE NOTICE '✅ VENDA CRIADA SEM TRIGGERS! ID: %', v_sale_id;
            
            -- Reabilitar triggers
            ALTER TABLE sistemaretiradas.sales ENABLE TRIGGER ALL;
            
        EXCEPTION WHEN OTHERS THEN
            -- Reabilitar triggers mesmo se deu erro
            ALTER TABLE sistemaretiradas.sales ENABLE TRIGGER ALL;
            
            RAISE WARNING '❌ ERRO AO CRIAR VENDA SEM TRIGGERS: %', SQLERRM;
            RAISE WARNING 'SQLSTATE: %', SQLSTATE;
        END;
    END IF;
    
END $$;

-- VERIFICAR SE VENDA FOI CRIADA
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.external_order_id,
    s.valor,
    s.created_at
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
   OR (s.external_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::TEXT 
       AND s.order_source = 'TINY');

-- ============================================================================
-- ✅ TESTE SEM TRIGGERS
-- ============================================================================

