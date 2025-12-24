-- ============================================================================
-- TESTAR PROCESSAR VENDA APÓS CORREÇÕES
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Testa se processar_tiny_order_para_venda funciona após executar
--            as correções (especialmente MAX(uuid))
-- ============================================================================

-- IMPORTANTE: Execute primeiro as migrations:
-- 1. 20251224000015_fix_max_uuid_attendance_link.sql (corrige MAX(uuid))
-- 2. 20251224000010_fix_processar_tiny_order_consistencia.sql (versão atualizada)

-- TESTAR COM FUNÇÃO DE DEBUG (mostra todos os passos)
-- ============================================================================
SELECT * FROM sistemaretiradas.processar_tiny_order_para_venda_debug(
    '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID -- Pedido 1558
);

-- TESTAR COM FUNÇÃO NORMAL (retorna apenas o UUID ou NULL)
-- ============================================================================
SELECT 
    '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID as tiny_order_id,
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
    s.attendance_id,
    s.created_at
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::UUID
   OR (s.external_order_id = '0c31a164-5532-4a9e-8e15-5d521a357342'::TEXT 
       AND s.order_source = 'TINY')
ORDER BY s.created_at DESC
LIMIT 5;

-- VERIFICAR SE A FUNÇÃO auto_link_erp_sale_to_attendance FOI CORRIGIDA
-- ============================================================================
-- Se a função ainda tiver MAX(attendance_id), vai dar erro aqui
SELECT pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'auto_link_erp_sale_to_attendance';

-- VERIFICAR SE HÁ TRIGGERS NA TABELA SALES
-- ============================================================================
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
WHERE tgrelid = 'sistemaretiradas.sales'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- ✅ SCRIPT DE TESTE APÓS CORREÇÕES
-- ============================================================================

