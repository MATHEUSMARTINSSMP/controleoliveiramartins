-- ============================================================================
-- PROCESSAR VENDAS PENDENTES DA SACADA
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processa todos os pedidos do Tiny da Sacada que não foram convertidos em vendas
-- ============================================================================

-- ID da loja Sacada | Oh, Boy: cee7d359-0240-4131-87a2-21ae44bd1bb4

-- 1. VERIFICAR QUANTOS PEDIDOS ESTÃO PENDENTES DA SACADA
-- ============================================================================
SELECT 
    COUNT(*) as total_pedidos_pendentes,
    COUNT(DISTINCT t_order.colaboradora_id) as colaboradoras_afetadas,
    SUM(t_order.valor_total) as valor_total_pendente,
    MIN(t_order.created_at) as pedido_mais_antigo,
    MAX(t_order.created_at) as pedido_mais_recente,
    COUNT(*) FILTER (WHERE t_order.created_at >= CURRENT_DATE) as pendentes_de_hoje
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
    AND t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0;

-- 2. VER PEDIDOS PENDENTES DETALHADOS DA SACADA
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.valor_total,
    t_order.data_pedido,
    t_order.created_at,
    p.name as colaboradora_nome,
    t_order.colaboradora_id
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles p ON p.id = t_order.colaboradora_id
WHERE s.id IS NULL
    AND t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0
ORDER BY t_order.created_at DESC;

-- 3. PROCESSAR TODOS OS PEDIDOS PENDENTES DA SACADA (ÚLTIMOS 30 DIAS)
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
    'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
    30 -- Últimos 30 dias (pode ajustar se necessário)
);

-- 4. VERIFICAR RESULTADO DO PROCESSAMENTO
-- ============================================================================
SELECT 
    COUNT(*) as pedidos_ainda_pendentes,
    SUM(t_order.valor_total) as valor_total_ainda_pendente,
    COUNT(*) FILTER (WHERE t_order.created_at >= CURRENT_DATE) as pendentes_de_hoje
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
    AND t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
    AND t_order.colaboradora_id IS NOT NULL
    AND t_order.store_id IS NOT NULL
    AND t_order.valor_total > 0;

-- 5. ALTERNATIVA: PROCESSAR APENAS PEDIDOS DE HOJE
-- ============================================================================
-- Se quiser processar apenas pedidos criados hoje, execute esta query:
-- SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
--     'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
--     1 -- Último dia (hoje)
-- );

-- ============================================================================
-- ✅ SCRIPT ESPECÍFICO PARA SACADA
-- ============================================================================

