-- ============================================================================
-- TESTE: INSERT DIRETO COM RESULTADO VISÍVEL
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Testa INSERT direto e retorna resultado como tabela
-- ============================================================================

-- FUNÇÃO TEMPORÁRIA PARA TESTAR INSERT
CREATE OR REPLACE FUNCTION sistemaretiradas.teste_insert_venda_direto(
    p_tiny_order_id UUID
)
RETURNS TABLE(
    passo TEXT,
    mensagem TEXT,
    sucesso BOOLEAN,
    sale_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pedido RECORD;
    v_qtd_pecas INTEGER := 1;
    v_observacoes TEXT;
    v_sale_id UUID;
BEGIN
    -- Passo 1: Buscar pedido
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
    WHERE id = p_tiny_order_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'ERRO'::TEXT, 'Pedido não encontrado'::TEXT, false, NULL::UUID;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 'PASSO1'::TEXT, 'Pedido encontrado: ' || v_pedido.numero_pedido, true, NULL::UUID;
    
    -- Passo 2: Calcular quantidade de peças
    IF v_pedido.itens IS NOT NULL AND jsonb_typeof(v_pedido.itens) = 'array' THEN
        SELECT COALESCE(SUM((item->>'quantidade')::INTEGER), 0)
        INTO v_qtd_pecas
        FROM jsonb_array_elements(v_pedido.itens) AS item
        WHERE (item->>'quantidade') IS NOT NULL;
    END IF;
    IF v_qtd_pecas = 0 THEN
        v_qtd_pecas := 1;
    END IF;
    
    RETURN QUERY SELECT 'PASSO2'::TEXT, 'Quantidade de peças: ' || v_qtd_pecas::TEXT, true, NULL::UUID;
    
    -- Passo 3: Preparar observações
    v_observacoes := COALESCE(v_pedido.observacoes, '');
    IF v_pedido.numero_pedido IS NOT NULL THEN
        IF v_observacoes != '' THEN
            v_observacoes := v_observacoes || ' | ';
        END IF;
        v_observacoes := v_observacoes || 'Pedido Tiny: #' || v_pedido.numero_pedido;
    END IF;
    
    RETURN QUERY SELECT 'PASSO3'::TEXT, 'Dados preparados'::TEXT, true, NULL::UUID;
    
    -- Passo 4: Tentar inserir
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
        
    EXCEPTION WHEN OTHERS THEN
        -- Retornar erro detalhado
        RETURN QUERY SELECT 
            'ERRO'::TEXT, 
            'Erro: ' || SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')'::TEXT, 
            false::BOOLEAN, 
            NULL::UUID;
        RETURN;
    END;
    
    -- Se chegou aqui, foi sucesso
    RETURN QUERY SELECT 
        'SUCESSO'::TEXT, 
        'Venda criada: ' || v_sale_id::TEXT, 
        true::BOOLEAN, 
        v_sale_id;
END;
$$;

-- TESTAR A FUNÇÃO
SELECT * FROM sistemaretiradas.teste_insert_venda_direto(
    '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
);

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
-- ✅ TESTE COM RESULTADO VISÍVEL
-- ============================================================================

