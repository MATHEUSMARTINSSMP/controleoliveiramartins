-- ============================================================================
-- VERIFICAR VENDAS DA LOJA SACADA: ERP vs SALES
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Comparar vendas recebidas pelo ERP com vendas criadas na tabela sales
-- ============================================================================

-- 1. IDENTIFICAR ID DA LOJA SACADA
-- ============================================================================
-- ID da loja: cee7d359-0240-4131-87a2-21ae44bd1bb4
SELECT 
    id,
    name,
    admin_id
FROM sistemaretiradas.stores
WHERE id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
ORDER BY name;

-- 2. VENDAS RECEBIDAS PELO ERP (TINY_ORDERS) - ÚLTIMOS 7 DIAS
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.vendedor_nome,
    t_order.colaboradora_id,
    c.name as colaboradora_nome,
    t_order.store_id,
    st.name as store_name,
    t_order.created_at as recebido_em,
    t_order.updated_at as atualizado_em,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA_ID'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '✅ DADOS VÁLIDOS'
    END as status_validacao
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    )
ORDER BY t_order.created_at DESC;

-- 3. VENDAS CRIADAS NA TABELA SALES - ÚLTIMOS 7 DIAS
-- ============================================================================
SELECT 
    s.id as sale_id,
    s.valor,
    s.qtd_pecas,
    s.data_venda,
    s.created_at as criado_em,
    s.tiny_order_id,
    s.external_order_id,
    s.order_source,
    s.colaboradora_id,
    c.name as colaboradora_nome,
    s.store_id,
    st.name as store_name
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND s.created_at >= NOW() - INTERVAL '7 days'
ORDER BY s.created_at DESC;

-- 4. COMPARAR: PEDIDOS DO ERP QUE NÃO TÊM VENDAS CORRESPONDENTES
-- ============================================================================
SELECT 
    t_order.id as tiny_order_id,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.vendedor_nome,
    t_order.colaboradora_id,
    c.name as colaboradora_nome,
    t_order.store_id,
    st.name as store_name,
    t_order.created_at as recebido_em,
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN '❌ SEM COLABORADORA_ID'
        WHEN t_order.store_id IS NULL THEN '❌ SEM STORE_ID'
        WHEN t_order.valor_total <= 0 THEN '❌ VALOR ZERO OU NEGATIVO'
        ELSE '⚠️ DADOS VÁLIDOS MAS NÃO PROCESSADO'
    END as motivo_nao_processado,
    s.id as sale_id_existente
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.profiles c ON c.id = t_order.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND s.id IS NULL -- Não tem venda correspondente
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    )
ORDER BY t_order.created_at DESC;

-- 5. RESUMO ESTATÍSTICO
-- ============================================================================
SELECT 
    'TOTAL DE PEDIDOS DO ERP' as tipo,
    COUNT(*) as quantidade,
    COUNT(DISTINCT t_order.numero_pedido) as pedidos_unicos,
    SUM(t_order.valor_total) as valor_total
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    )

UNION ALL

SELECT 
    'VENDAS CRIADAS NA TABELA SALES' as tipo,
    COUNT(*) as quantidade,
    COUNT(DISTINCT s.id) as pedidos_unicos,
    SUM(s.valor) as valor_total
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND s.created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'PEDIDOS NÃO PROCESSADOS (SEM VENDA)' as tipo,
    COUNT(*) as quantidade,
    COUNT(DISTINCT t_order.numero_pedido) as pedidos_unicos,
    SUM(t_order.valor_total) as valor_total
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND s.id IS NULL
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    );

-- 6. MOTIVOS DETALHADOS DOS PEDIDOS NÃO PROCESSADOS
-- ============================================================================
SELECT 
    CASE 
        WHEN t_order.colaboradora_id IS NULL THEN 'SEM COLABORADORA_ID'
        WHEN t_order.store_id IS NULL THEN 'SEM STORE_ID'
        WHEN t_order.valor_total <= 0 THEN 'VALOR ZERO OU NEGATIVO'
        ELSE 'DADOS VÁLIDOS (VERIFICAR TRIGGER)'
    END as motivo,
    COUNT(*) as quantidade,
    SUM(t_order.valor_total) as valor_total_perdido
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.stores st ON st.id = t_order.store_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4' -- Sacada | Oh, Boy
    AND s.id IS NULL -- Não tem venda
    AND (
        t_order.created_at >= NOW() - INTERVAL '7 days'
        OR t_order.updated_at >= NOW() - INTERVAL '7 days'
    )
GROUP BY motivo
ORDER BY quantidade DESC;

