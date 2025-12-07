-- ============================================================================
-- VERIFICAR: Se a venda do pedido 1419 foi criada e aparece no dashboard
-- ============================================================================

-- 1. Verificar se a venda existe
SELECT 
    '1. VENDA CRIADA' as verificacao,
    s.id as sale_id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    t_order.numero_pedido,
    c.name as colaboradora_nome,
    st.name as loja_nome,
    -- Verificar se está no filtro de hoje
    CASE 
        WHEN s.data_venda::date = CURRENT_DATE THEN '✅ APARECE NO FILTRO DE HOJE'
        ELSE '❌ NÃO APARECE NO FILTRO DE HOJE'
    END as status_filtro
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_order ON t_order.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.tiny_order_id = '91f7122c-a11f-436b-8179-a95f80a8e2eb'
   OR t_order.numero_pedido = '1419';

-- 2. Simular o filtro do frontend para hoje
SELECT 
    '2. SIMULAÇÃO DO FILTRO DO FRONTEND (HOJE)' as verificacao,
    s.id,
    s.data_venda,
    s.store_id,
    st.name as loja_nome,
    -- Simular filtro: .gte('data_venda', '2025-12-01T00:00:00') .lte('data_venda', '2025-12-01T23:59:59')
    CASE 
        WHEN s.data_venda >= (CURRENT_DATE::text || 'T00:00:00')::timestamp 
         AND s.data_venda <= (CURRENT_DATE::text || 'T23:59:59')::timestamp
        THEN '✅ SERIA ENCONTRADO'
        ELSE '❌ NÃO SERIA ENCONTRADO'
    END as resultado_filtro,
    s.data_venda::text as data_venda_formatada,
    (CURRENT_DATE::text || 'T00:00:00')::timestamp as inicio_dia,
    (CURRENT_DATE::text || 'T23:59:59')::timestamp as fim_dia
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.tiny_order_id = '91f7122c-a11f-436b-8179-a95f80a8e2eb';

-- 3. Verificar todas as vendas de hoje com tiny_order_id
SELECT 
    '3. TODAS AS VENDAS DE HOJE (ERP)' as verificacao,
    COUNT(*) as total_vendas_hoje,
    SUM(s.valor) as valor_total_hoje
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id IS NOT NULL
  AND s.data_venda::date = CURRENT_DATE;

