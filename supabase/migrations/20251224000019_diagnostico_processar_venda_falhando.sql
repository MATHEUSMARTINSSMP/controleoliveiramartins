-- ============================================================================
-- DIAGNÓSTICO: POR QUE processar_tiny_order_para_venda ESTÁ RETORNANDO NULL?
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Testa um pedido específico para ver exatamente onde está falhando
-- ============================================================================

-- TESTAR UM PEDIDO ESPECÍFICO COM A FUNÇÃO DE DEBUG
-- ============================================================================
-- Vamos testar o pedido 1558 que é válido mas não está sendo processado
SELECT * FROM sistemaretiradas.processar_tiny_order_para_venda_debug(
    '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID -- Pedido 1558
);

-- VERIFICAR SE EXISTE VENDA JÁ CRIADA PARA ESTE PEDIDO
-- ============================================================================
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.external_order_id,
    s.order_source,
    s.valor,
    s.colaboradora_id,
    s.store_id,
    s.created_at
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
   OR (s.external_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::TEXT 
       AND s.order_source = 'TINY');

-- VERIFICAR DADOS DO PEDIDO
-- ============================================================================
SELECT 
    id,
    numero_pedido,
    store_id,
    colaboradora_id,
    valor_total,
    data_pedido,
    forma_pagamento,
    formas_pagamento_json,
    itens,
    observacoes
FROM sistemaretiradas.tiny_orders
WHERE id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID;

-- TESTAR INSERT DIRETO NA TABELA SALES PARA VER QUAL É O ERRO
-- ============================================================================
-- Esta query vai mostrar qual é o erro exato ao tentar criar a venda
DO $$
DECLARE
    v_pedido RECORD;
    v_sale_id UUID;
    v_qtd_pecas INTEGER := 1;
    v_observacoes TEXT;
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
    
    RAISE NOTICE 'Pedido encontrado: %', v_pedido.numero_pedido;
    RAISE NOTICE 'Store ID: %', v_pedido.store_id;
    RAISE NOTICE 'Colaboradora ID: %', v_pedido.colaboradora_id;
    RAISE NOTICE 'Valor Total: %', v_pedido.valor_total;
    
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
    
    RAISE NOTICE 'Quantidade de peças: %', v_qtd_pecas;
    
    -- Preparar observações
    v_observacoes := COALESCE(v_pedido.observacoes, '');
    IF v_pedido.numero_pedido IS NOT NULL THEN
        IF v_observacoes != '' THEN
            v_observacoes := v_observacoes || ' | ';
        END IF;
        v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
    END IF;
    
    RAISE NOTICE 'Tentando criar venda...';
    
    -- Tentar criar venda
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
        
        -- Rollback para não criar de verdade neste teste
        RAISE EXCEPTION 'TESTE: Rollback intencional. Venda seria criada com ID: %', v_sale_id;
        
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'TESTE: Rollback intencional%' THEN
            RAISE NOTICE '✅ Teste concluído: venda pode ser criada!';
        ELSE
            RAISE WARNING '❌ ERRO AO CRIAR VENDA: %', SQLERRM;
            RAISE WARNING 'SQLSTATE: %', SQLSTATE;
        END IF;
    END;
END $$;

-- ============================================================================
-- ✅ SCRIPT DE DIAGNÓSTICO
-- ============================================================================

