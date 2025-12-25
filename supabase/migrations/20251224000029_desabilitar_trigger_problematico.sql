-- ============================================================================
-- DESABILITAR TRIGGER PROBLEMÁTICO TEMPORARIAMENTE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Desabilita trigger_try_auto_link_erp_sale temporariamente para
--            permitir que vendas sejam criadas enquanto investigamos o problema
-- ============================================================================

-- DESABILITAR TRIGGER TEMPORARIAMENTE
-- ============================================================================
ALTER TABLE sistemaretiradas.sales DISABLE TRIGGER trigger_try_auto_link_erp_sale;

-- TESTAR SE AGORA FUNCIONA
SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID) as sale_id_criado;

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
-- NOTA: Após processar as vendas pendentes, você pode reabilitar o trigger
-- executando: ALTER TABLE sistemaretiradas.sales ENABLE TRIGGER trigger_try_auto_link_erp_sale;
-- ============================================================================

