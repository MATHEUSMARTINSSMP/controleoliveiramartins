-- ============================================================================
-- INVESTIGAÇÃO PROFUNDA: Vendas Duplicadas ou Conflitantes
-- ============================================================================

-- 1. Verificar se há vendas com mesmo valor, data, colaboradora mas IDs diferentes
SELECT 
    s1.id as sale_1_id,
    s1.tiny_order_id as sale_1_tiny_order_id,
    s2.id as sale_2_id,
    s2.tiny_order_id as sale_2_tiny_order_id,
    s1.colaboradora_id,
    p.name as colaboradora_nome,
    s1.valor,
    s1.data_venda,
    s1.created_at as sale_1_created,
    s2.created_at as sale_2_created,
    CASE 
        WHEN s1.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END as sale_1_origem,
    CASE 
        WHEN s2.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END as sale_2_origem
FROM sistemaretiradas.sales s1
JOIN sistemaretiradas.sales s2 ON 
    s1.id < s2.id -- Evitar duplicar os pares
    AND s1.colaboradora_id = s2.colaboradora_id
    AND s1.valor = s2.valor
    AND DATE(s1.data_venda) = DATE(s2.data_venda)
    AND s1.store_id = s2.store_id
LEFT JOIN sistemaretiradas.profiles p ON s1.colaboradora_id = p.id
WHERE s1.store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
    AND DATE(s1.data_venda) >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY s1.data_venda DESC, s1.valor DESC;

-- 2. Verificar se há tiny_orders que geraram vendas, mas também existem vendas manuais
SELECT 
    to_o.id as tiny_order_id,
    to_o.numero_pedido,
    to_o.valor_total,
    to_o.data_pedido,
    to_o.colaboradora_id,
    p.name as colaboradora_nome,
    s_auto.id as sale_auto_id,
    s_auto.tiny_order_id as sale_auto_tiny_order_id,
    s_manual.id as sale_manual_id,
    s_manual.tiny_order_id as sale_manual_tiny_order_id,
    s_manual.valor as sale_manual_valor,
    s_manual.data_venda as sale_manual_data
FROM sistemaretiradas.tiny_orders to_o
LEFT JOIN sistemaretiradas.sales s_auto ON s_auto.tiny_order_id = to_o.id
LEFT JOIN sistemaretiradas.sales s_manual ON 
    s_manual.tiny_order_id IS NULL
    AND s_manual.colaboradora_id = to_o.colaboradora_id
    AND s_manual.valor = to_o.valor_total
    AND DATE(s_manual.data_venda) = DATE(to_o.data_pedido)
    AND s_manual.store_id = to_o.store_id
LEFT JOIN sistemaretiradas.profiles p ON to_o.colaboradora_id = p.id
WHERE to_o.store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
    AND DATE(to_o.data_pedido) >= CURRENT_DATE - INTERVAL '7 days'
    AND s_auto.id IS NOT NULL
    AND s_manual.id IS NOT NULL
ORDER BY to_o.data_pedido DESC;

-- 3. Verificar todas as vendas de hoje com detalhes completos
SELECT 
    s.id,
    s.tiny_order_id,
    s.colaboradora_id,
    p.name as colaboradora_nome,
    s.valor,
    s.data_venda,
    s.created_at,
    s.updated_at,
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END as origem,
    to_o.numero_pedido as tiny_numero_pedido,
    to_o.created_at as tiny_created_at
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles p ON s.colaboradora_id = p.id
LEFT JOIN sistemaretiradas.tiny_orders to_o ON s.tiny_order_id = to_o.id
WHERE s.store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
    AND DATE(s.data_venda) = CURRENT_DATE
ORDER BY s.data_venda DESC, s.created_at DESC;

-- 4. Contar vendas por tipo (Manual vs ERP) hoje
SELECT 
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END as origem,
    COUNT(*) as quantidade,
    SUM(s.valor) as total_valor
FROM sistemaretiradas.sales s
WHERE s.store_id = (SELECT id FROM sistemaretiradas.stores WHERE active = true LIMIT 1)
    AND DATE(s.data_venda) = CURRENT_DATE
GROUP BY 
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN 'ERP'
        ELSE 'Manual'
    END;

