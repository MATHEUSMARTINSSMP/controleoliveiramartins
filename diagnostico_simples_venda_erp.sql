-- ============================================================
-- DIAGNÓSTICO ÚNICO: POR QUE VENDA DO ERP NÃO APARECE NO DASHBOARD
-- ============================================================
-- Esta query mostra TUDO de uma vez:
-- - Se o pedido existe no tiny_orders
-- - Se foi sincronizado para sales  
-- - Store ID, Colaboradora, etc.
-- ============================================================

WITH pedidos_erp AS (
    SELECT 
        t_ord.id as tiny_order_id,
        t_ord.numero_pedido,
        t_ord.data_pedido,
        t_ord.cliente_nome,
        t_ord.vendedor_nome,
        t_ord.valor_total,
        t_ord.store_id as erp_store_id,
        t_ord.colaboradora_id as erp_colab_id,
        t_ord.sync_at,
        t_ord.created_at,
        t_ord.updated_at
    FROM sistemaretiradas.tiny_orders t_ord
    WHERE 
        (t_ord.data_pedido >= NOW() - INTERVAL '24 hours')
        OR LOWER(t_ord.cliente_nome) LIKE '%maria%helena%'
        OR t_ord.numero_pedido::text = '1449'
),
vendas_sales AS (
    SELECT 
        s.id as sales_id,
        s.data_venda,
        s.valor,
        s.store_id as sales_store_id,
        s.colaboradora_id as sales_colab_id,
        s.tiny_order_id
    FROM sistemaretiradas.sales s
    WHERE s.data_venda::date >= CURRENT_DATE - INTERVAL '1 day'
)
SELECT 
    pe.numero_pedido,
    pe.cliente_nome as cliente,
    pe.vendedor_nome as vendedor_erp,
    pe.data_pedido as data_erp,
    pe.valor_total as valor_erp,
    pe.erp_store_id,
    st.name as store_name,
    pe.erp_colab_id,
    p_colab.name as colaboradora_name,
    CASE 
        WHEN vs.sales_id IS NOT NULL THEN '✅ SIM - Existe em sales'
        ELSE '❌ NÃO - NÃO existe em sales'
    END as sincronizado,
    vs.sales_id,
    vs.data_venda as data_sales,
    vs.valor as valor_sales,
    vs.sales_store_id,
    vs.sales_colab_id,
    CASE 
        WHEN pe.erp_store_id IS NULL THEN '❌ ERRO: store_id NULL no tiny_orders'
        WHEN st.id IS NULL THEN '❌ ERRO: Loja não encontrada'
        ELSE '✅ Loja OK'
    END as status_loja,
    CASE 
        WHEN pe.erp_colab_id IS NULL THEN '⚠️ Sem colaboradora no ERP'
        WHEN p_colab.id IS NULL THEN '❌ Colaboradora não encontrada'
        WHEN p_colab.is_active = false THEN '⚠️ Colaboradora INATIVA'
        ELSE '✅ Colaboradora OK'
    END as status_colab,
    CASE 
        WHEN vs.sales_id IS NULL THEN '❌ PROBLEMA: Pedido não sincronizado para sales'
        WHEN pe.erp_store_id != vs.sales_store_id THEN '❌ ERRO: store_id diferente entre ERP e sales'
        WHEN pe.erp_colab_id != vs.sales_colab_id THEN '⚠️ AVISO: colaboradora_id diferente'
        ELSE '✅ Sincronização OK'
    END as diagnostico_final
FROM pedidos_erp pe
LEFT JOIN sistemaretiradas.stores st ON st.id = pe.erp_store_id
LEFT JOIN sistemaretiradas.profiles p_colab ON p_colab.id = pe.erp_colab_id
LEFT JOIN vendas_sales vs ON vs.tiny_order_id = pe.tiny_order_id
ORDER BY pe.data_pedido DESC
LIMIT 50;

