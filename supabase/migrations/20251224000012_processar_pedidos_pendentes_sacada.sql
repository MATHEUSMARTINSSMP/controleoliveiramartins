-- ============================================================================
-- PROCESSAR PEDIDOS PENDENTES DA SACADA MANUALMENTE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Processar os 8 pedidos que têm dados válidos mas não foram criados como sales
-- ============================================================================

-- PROCESSAR TODOS OS PEDIDOS PENDENTES DA SACADA
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_pedidos_pendentes_loja(
    'cee7d359-0240-4131-87a2-21ae44bd1bb4'::UUID, -- Sacada | Oh, Boy
    7 -- últimos 7 dias
);

-- VERIFICAR SE OS PEDIDOS FORAM PROCESSADOS
-- ============================================================================
-- Comparar antes e depois
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.colaboradora_id,
    c.name as colaboradora_nome,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ PROCESSADO'
        ELSE '❌ NÃO PROCESSADO'
    END as status_processamento,
    s.id as sale_id,
    s.created_at as sale_criado_em
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND t_order.numero_pedido IN ('1558', '1557', '1556', '1555', '1554', '1553', '1552', '1551')
ORDER BY t_order.numero_pedido DESC;

-- TESTAR PROCESSAMENTO MANUAL DE UM PEDIDO ESPECÍFICO
-- ============================================================================
-- Descomente para testar um pedido específico:
/*
SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID);
*/

-- VERIFICAR LOGS DE ERRO NO TRIGGER (se houver)
-- ============================================================================
-- Verificar se há mensagens de warning nos logs do PostgreSQL
-- Isso requer acesso aos logs do Supabase

