-- ============================================================================
-- GARANTIR QUE TRIGGER DE VENDAS ESTÁ FUNCIONANDO CORRETAMENTE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Garantir que o trigger processa vendas automaticamente e reprocessar pendentes
-- ============================================================================

-- 1. GARANTIR QUE A FUNÇÃO DO TRIGGER EXISTE (CRIAR/ATUALIZAR)
-- ============================================================================
-- Primeiro, criar/atualizar a função (isso pode ser feito fora de DO)

CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_processar_tiny_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Processar apenas se o pedido tem dados válidos
    IF NEW.colaboradora_id IS NOT NULL 
       AND NEW.store_id IS NOT NULL 
       AND NEW.valor_total > 0 THEN
        -- Tentar processar (erros não devem quebrar o INSERT/UPDATE)
        BEGIN
            PERFORM sistemaretiradas.processar_tiny_order_para_venda(NEW.id);
        EXCEPTION WHEN OTHERS THEN
            -- Logar erro mas não falhar a transação
            RAISE WARNING 'Erro ao processar pedido % para venda no trigger: %', NEW.id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.trigger_processar_tiny_order() IS 
'Trigger que processa automaticamente pedidos do Tiny ERP para criar/atualizar vendas. 
Executa em INSERT e UPDATE, mas apenas quando colaboradora_id, store_id e valor_total são válidos.';

-- 2. GARANTIR QUE O TRIGGER ESTÁ CRIADO
-- ============================================================================
-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_auto_processar_tiny_order ON sistemaretiradas.tiny_orders;

-- Criar trigger
CREATE TRIGGER trigger_auto_processar_tiny_order
AFTER INSERT OR UPDATE ON sistemaretiradas.tiny_orders
FOR EACH ROW
WHEN (NEW.colaboradora_id IS NOT NULL AND NEW.store_id IS NOT NULL AND NEW.valor_total > 0)
EXECUTE FUNCTION sistemaretiradas.trigger_processar_tiny_order();

-- 3. FUNÇÃO AUXILIAR PARA PROCESSAR TODOS OS PEDIDOS PENDENTES DE UMA LOJA
-- ============================================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.processar_pedidos_pendentes_loja(
    p_store_id UUID,
    p_dias_retrocesso INTEGER DEFAULT 7
)
RETURNS TABLE (
    pedidos_processados INTEGER,
    vendas_criadas INTEGER,
    erros INTEGER,
    detalhes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pedido RECORD;
    v_sale_id UUID;
    v_processados INTEGER := 0;
    v_criadas INTEGER := 0;
    v_erros INTEGER := 0;
    v_detalhes JSONB := '[]'::JSONB;
    v_erro_detalhes JSONB;
BEGIN
    -- Buscar todos os pedidos válidos que não têm vendas
    FOR v_pedido IN
        SELECT 
            t_order.id,
            t_order.numero_pedido,
            t_order.valor_total,
            t_order.colaboradora_id,
            t_order.store_id
        FROM sistemaretiradas.tiny_orders t_order
        LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
        WHERE t_order.store_id = p_store_id
            AND s.id IS NULL -- Não tem venda
            AND t_order.colaboradora_id IS NOT NULL
            AND t_order.store_id IS NOT NULL
            AND t_order.valor_total > 0
            AND (
                t_order.created_at >= NOW() - (p_dias_retrocesso || ' days')::INTERVAL
                OR t_order.updated_at >= NOW() - (p_dias_retrocesso || ' days')::INTERVAL
            )
        ORDER BY t_order.created_at ASC
    LOOP
        BEGIN
            v_processados := v_processados + 1;
            
            -- Tentar processar
            v_sale_id := sistemaretiradas.processar_tiny_order_para_venda(v_pedido.id);
            
            IF v_sale_id IS NOT NULL THEN
                v_criadas := v_criadas + 1;
                v_detalhes := v_detalhes || jsonb_build_object(
                    'tiny_order_id', v_pedido.id,
                    'numero_pedido', v_pedido.numero_pedido,
                    'sale_id', v_sale_id,
                    'status', 'criada'
                );
            ELSE
                v_erros := v_erros + 1;
                v_detalhes := v_detalhes || jsonb_build_object(
                    'tiny_order_id', v_pedido.id,
                    'numero_pedido', v_pedido.numero_pedido,
                    'status', 'erro',
                    'motivo', 'processar_tiny_order_para_venda retornou NULL'
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_erros := v_erros + 1;
            v_erro_detalhes := jsonb_build_object(
                'tiny_order_id', v_pedido.id,
                'numero_pedido', v_pedido.numero_pedido,
                'status', 'erro',
                'erro', SQLERRM
            );
            v_detalhes := v_detalhes || v_erro_detalhes;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_processados, v_criadas, v_erros, v_detalhes;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_pedidos_pendentes_loja IS 
'Processa todos os pedidos pendentes de uma loja que não têm vendas correspondentes. 
Útil para reprocessar pedidos que não foram processados automaticamente pelo trigger.';

-- 4. EXECUTAR PROCESSAMENTO MANUAL PARA LOUNGERIE
-- ============================================================================
-- Processar pedidos pendentes dos últimos 7 dias
SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
    '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'::UUID, -- Loungerie
    7 -- 7 dias
);

-- 5. VERIFICAR RESULTADO DO PROCESSAMENTO
-- ============================================================================
SELECT 
    COUNT(*) as total_pedidos_pendentes,
    COUNT(DISTINCT t_order.numero_pedido) as pedidos_unicos_pendentes
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
    AND s.id IS NULL
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    );

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

