-- ============================================================================
-- PROCESSAR APENAS PEDIDOS VÁLIDOS DA SACADA
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processa apenas pedidos válidos (com colaboradora) da Sacada
--            Ignora pedidos sem colaboradora (não podem ser processados)
-- ============================================================================

-- ID da loja Sacada | Oh, Boy: cee7d359-0240-4131-87a2-21ae44bd1bb4

-- VERIFICAR STATUS ANTES DE PROCESSAR
-- ============================================================================
SELECT 
    'ANTES' as momento,
    COUNT(*) FILTER (WHERE t_order.colaboradora_id IS NOT NULL AND s.id IS NULL) as pedidos_validos_pendentes,
    COUNT(*) FILTER (WHERE t_order.colaboradora_id IS NULL) as pedidos_sem_colaboradora,
    COUNT(*) FILTER (WHERE s.id IS NOT NULL) as pedidos_ja_processados,
    SUM(t_order.valor_total) FILTER (WHERE t_order.colaboradora_id IS NOT NULL AND s.id IS NULL) as valor_pendente_valido
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.valor_total > 0;

-- PROCESSAR APENAS PEDIDOS VÁLIDOS (COM COLABORADORA)
-- ============================================================================
DO $$
DECLARE
    v_tiny_order RECORD;
    v_sale_id UUID;
    v_processados INTEGER := 0;
    v_erros INTEGER := 0;
BEGIN
    -- Processar cada pedido válido pendente
    FOR v_tiny_order IN 
        SELECT t_order.id
        FROM sistemaretiradas.tiny_orders t_order
        LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
        WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
            AND t_order.colaboradora_id IS NOT NULL
            AND t_order.store_id IS NOT NULL
            AND t_order.valor_total > 0
            AND s.id IS NULL
        ORDER BY t_order.created_at DESC
    LOOP
        BEGIN
            v_sale_id := sistemaretiradas.processar_tiny_order_para_venda(v_tiny_order.id);
            
            IF v_sale_id IS NOT NULL THEN
                v_processados := v_processados + 1;
                RAISE NOTICE '✅ Pedido % processado -> Venda %', v_tiny_order.id, v_sale_id;
            ELSE
                v_erros := v_erros + 1;
                RAISE WARNING '❌ Falha ao processar pedido %', v_tiny_order.id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_erros := v_erros + 1;
            RAISE WARNING '❌ Erro ao processar pedido %: %', v_tiny_order.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMO: % processados, % erros', v_processados, v_erros;
    RAISE NOTICE '========================================';
END $$;

-- VERIFICAR STATUS DEPOIS DE PROCESSAR
-- ============================================================================
SELECT 
    'DEPOIS' as momento,
    COUNT(*) FILTER (WHERE t_order.colaboradora_id IS NOT NULL AND s.id IS NULL) as pedidos_validos_pendentes,
    COUNT(*) FILTER (WHERE t_order.colaboradora_id IS NULL) as pedidos_sem_colaboradora,
    COUNT(*) FILTER (WHERE s.id IS NOT NULL) as pedidos_ja_processados,
    SUM(t_order.valor_total) FILTER (WHERE t_order.colaboradora_id IS NOT NULL AND s.id IS NULL) as valor_pendente_valido
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.valor_total > 0;

-- LISTAR PEDIDOS VÁLIDOS QUE AINDA ESTÃO PENDENTES (SE HOUVER)
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.valor_total,
    t_order.data_pedido,
    p.name as colaboradora_nome,
    '✅ Válido' as status_validacao
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles p ON p.id = t_order.colaboradora_id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.valor_total > 0
    AND s.id IS NULL
ORDER BY t_order.created_at DESC
LIMIT 20;

-- ============================================================================
-- ✅ PROCESSAMENTO CONCLUÍDO
-- ============================================================================
-- NOTA: Pedidos sem colaboradora não podem ser processados automaticamente.
--       Eles precisam ter uma colaboradora associada no Tiny ERP primeiro.
-- ============================================================================

