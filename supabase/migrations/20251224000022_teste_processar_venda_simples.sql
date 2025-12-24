-- ============================================================================
-- TESTE SIMPLES: PROCESSAR VENDA DIRETO
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Testa processar_tiny_order_para_venda de forma simples
-- ============================================================================

-- TESTAR PROCESSAR UM PEDIDO ESPECÍFICO
-- ============================================================================
SELECT 
    'Teste processar venda' as teste,
    sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID) as sale_id_criado;

-- VERIFICAR SE VENDA FOI CRIADA
-- ============================================================================
SELECT 
    s.id as sale_id,
    s.tiny_order_id,
    s.external_order_id,
    s.order_source,
    s.valor,
    s.colaboradora_id,
    s.created_at
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
   OR (s.external_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::TEXT 
       AND s.order_source = 'TINY')
ORDER BY s.created_at DESC
LIMIT 1;

-- VER LOGS DE WARNING/ERROR (se houver)
-- ============================================================================
-- Execute isso no psql para ver os logs:
-- SHOW client_min_messages;
-- SET client_min_messages TO WARNING;
-- SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID);

-- ============================================================================
-- ✅ TESTE SIMPLES
-- ============================================================================

