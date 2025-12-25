-- ============================================================================
-- PROCESSAR TODOS OS PEDIDOS PENDENTES DA SACADA
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processa todos os pedidos pendentes da Sacada agora que a função está funcionando
-- ============================================================================

-- ID da loja Sacada | Oh, Boy: cee7d359-0240-4131-87a2-21ae44bd1bb4

-- PROCESSAR TODOS OS PEDIDOS PENDENTES (ÚLTIMOS 30 DIAS)
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
    'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
    30 -- Últimos 30 dias
);

-- VERIFICAR RESULTADO - PEDIDOS AINDA PENDENTES
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

-- VER PEDIDOS QUE AINDA ESTÃO PENDENTES (SE HOUVER)
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.valor_total,
    t_order.data_pedido,
    t_order.created_at,
    p.name as colaboradora_nome,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ Sem colaboradora'
        WHEN t_order.store_id IS NULL THEN '❌ Sem loja'
        WHEN t_order.valor_total <= 0 THEN '❌ Valor inválido'
        ELSE '✅ Válido'
    END as status_validacao
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
LEFT JOIN sistemaretiradas.profiles p ON p.id = t_order.colaboradora_id
WHERE s.id IS NULL
    AND t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
ORDER BY t_order.created_at DESC
LIMIT 20;

-- ============================================================================
-- ✅ PROCESSAMENTO CONCLUÍDO
-- ============================================================================

