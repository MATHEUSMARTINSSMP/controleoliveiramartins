-- ============================================================================
-- PROCESSAR VENDAS PENDENTES DA SACADA - MÉTODO DIRETO
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processa diretamente os pedidos pendentes da Sacada, um por um
-- ============================================================================

-- ID da loja Sacada | Oh, Boy: cee7d359-0240-4131-87a2-21ae44bd1bb4

-- 1. LISTAR PEDIDOS PENDENTES COM DETALHES
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.valor_total,
    t_order.data_pedido,
    t_order.created_at,
    p.name as colaboradora_nome,
    t_order.colaboradora_id,
    t_order.store_id,
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
ORDER BY t_order.created_at DESC;

-- 2. PROCESSAR CADA PEDIDO INDIVIDUALMENTE E VER RESULTADO
-- ============================================================================
-- Esta query processa cada pedido e mostra o resultado
WITH pedidos_pendentes AS (
    SELECT 
        t_order.id as tiny_order_id,
        t_order.numero_pedido,
        t_order.valor_total
    FROM sistemaretiradas.tiny_orders t_order
    LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
    WHERE s.id IS NULL
        AND t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID
        AND t_order.colaboradora_id IS NOT NULL
        AND t_order.store_id IS NOT NULL
        AND t_order.valor_total > 0
)
SELECT 
    pp.tiny_order_id,
    pp.numero_pedido,
    pp.valor_total,
    sistemaretiradas.processar_tiny_order_para_venda(pp.tiny_order_id) as sale_id_criado,
    CASE 
        WHEN sistemaretiradas.processar_tiny_order_para_venda(pp.tiny_order_id) IS NOT NULL 
        THEN '✅ Processado com sucesso'
        ELSE '❌ Falha no processamento'
    END as status
FROM pedidos_pendentes pp
ORDER BY pp.numero_pedido;

-- 3. PROCESSAR TODOS DE UMA VEZ USANDO A FUNÇÃO DE BULK
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
    'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
    1 -- Último dia (hoje)
);

-- 4. VERIFICAR RESULTADO FINAL
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

-- ============================================================================
-- ✅ SCRIPT PARA PROCESSAMENTO DIRETO
-- ============================================================================

