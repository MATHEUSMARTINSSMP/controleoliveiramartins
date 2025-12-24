-- ============================================================================
-- PROCESSAR VENDAS PENDENTES DE HOJE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processa todos os pedidos do Tiny que não foram convertidos em vendas
--            por causa do erro MAX(uuid) que já foi corrigido
-- ============================================================================

-- 1. VERIFICAR QUANTOS PEDIDOS ESTÃO PENDENTES DE HOJE
-- ============================================================================
SELECT 
    COUNT(*) as total_pedidos_pendentes,
    COUNT(DISTINCT t_order.store_id) as lojas_afetadas,
    COUNT(DISTINCT t_order.colaboradora_id) as colaboradoras_afetadas,
    SUM(t_order.valor_total) as valor_total_pendente,
    MIN(t_order.created_at) as pedido_mais_antigo,
    MAX(t_order.created_at) as pedido_mais_recente
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0
    AND t_order.created_at >= CURRENT_DATE; -- Pedidos de hoje

-- 2. VER PEDIDOS PENDENTES POR LOJA
-- ============================================================================
SELECT 
    s.name as loja_nome,
    t_order.store_id,
    COUNT(*) as pedidos_pendentes,
    SUM(t_order.valor_total) as valor_total_pendente,
    COUNT(DISTINCT t_order.colaboradora_id) as colaboradoras_afetadas
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s_venda ON s_venda.tiny_order_id = t_order.id
JOIN sistemaretiradas.stores s ON s.id = t_order.store_id
WHERE s_venda.id IS NULL
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0
    AND t_order.created_at >= CURRENT_DATE -- Pedidos de hoje
GROUP BY s.name, t_order.store_id
ORDER BY pedidos_pendentes DESC;

-- 3. PROCESSAR TODAS AS LOJAS (PEDIDOS DE HOJE)
-- ============================================================================
-- Processa pedidos pendentes de hoje para todas as lojas
-- Isso vai usar a função processar_pedidos_pendentes_loja para cada loja
DO $$
DECLARE
    v_loja RECORD;
    v_result RECORD;
    v_total_processados INTEGER := 0;
    v_total_criadas INTEGER := 0;
    v_total_erros INTEGER := 0;
BEGIN
    RAISE NOTICE '=== INICIANDO PROCESSAMENTO DE VENDAS PENDENTES DE HOJE ===';
    
    -- Processar para cada loja que tem pedidos pendentes
    FOR v_loja IN 
        SELECT DISTINCT t_order.store_id
        FROM sistemaretiradas.tiny_orders t_order
        LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
        WHERE s.id IS NULL
            AND t_order.colaboradora_id IS NOT NULL
            AND t_order.store_id IS NOT NULL
            AND t_order.valor_total > 0
            AND t_order.created_at >= CURRENT_DATE
    LOOP
        RAISE NOTICE 'Processando loja: %', v_loja.store_id;
        
        -- Processar pedidos pendentes de hoje (último dia)
        SELECT * INTO v_result
        FROM sistemaretiradas.processar_pedidos_pendentes_loja(
            v_loja.store_id,
            1 -- Último dia (hoje)
        );
        
        v_total_processados := v_total_processados + COALESCE(v_result.vendas_criadas, 0) + COALESCE(v_result.vendas_atualizadas, 0);
        v_total_criadas := v_total_criadas + COALESCE(v_result.vendas_criadas, 0);
        v_total_erros := v_total_erros + COALESCE(v_result.erros, 0);
        
        RAISE NOTICE '  Loja %: % criadas, % atualizadas, % erros', 
            v_loja.store_id,
            COALESCE(v_result.vendas_criadas, 0),
            COALESCE(v_result.vendas_atualizadas, 0),
            COALESCE(v_result.erros, 0);
    END LOOP;
    
    RAISE NOTICE '=== PROCESSAMENTO CONCLUÍDO ===';
    RAISE NOTICE 'Total processado: %, Criadas: %, Erros: %', 
        v_total_processados, v_total_criadas, v_total_erros;
END $$;

-- 4. VERIFICAR RESULTADO DO PROCESSAMENTO
-- ============================================================================
SELECT 
    COUNT(*) as pedidos_ainda_pendentes,
    COUNT(DISTINCT t_order.store_id) as lojas_ainda_afetadas,
    SUM(t_order.valor_total) as valor_total_ainda_pendente
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0
    AND t_order.created_at >= CURRENT_DATE;

-- 5. ALTERNATIVA: PROCESSAR LOJA ESPECÍFICA
-- ============================================================================
-- Se quiser processar apenas uma loja específica, use:
-- SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
--     'ID_DA_LOJA_AQUI'::UUID, -- Substitua pelo ID da loja
--     1 -- Último dia (hoje)
-- );

-- Exemplo para Loungerie:
-- SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
--     '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'::UUID, -- Loungerie
--     1 -- Último dia (hoje)
-- );

-- Exemplo para Sacada:
-- SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
--     'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
--     1 -- Último dia (hoje)
-- );

-- ============================================================================
-- ✅ SCRIPT COMPLETO
-- ============================================================================

