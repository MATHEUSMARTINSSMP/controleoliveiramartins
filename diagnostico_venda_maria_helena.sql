-- ============================================================
-- DIAGNÓSTICO COMPLETO: POR QUE VENDA DO ERP NÃO APARECE NO DASHBOARD
-- ============================================================
-- Esta query verifica:
-- 1. Se o pedido existe no tiny_orders
-- 2. Se foi sincronizado para sales
-- 3. Se tem store_id correto
-- 4. Se tem colaboradora_id vinculado
-- 5. Compara dados do ERP vs sistema
-- ============================================================

-- PASSO 1: Verificar pedidos recentes do Tiny ERP (últimas 24h)
-- Procurar pelo pedido 1449 ou cliente "Maria Helena"
SELECT 
    'PEDIDOS DO TINY_ORDERS (últimas 24h)' as tipo,
    to.id,
    to.numero_pedido,
    to.data_pedido,
    to.cliente_nome,
    to.cliente_cpf,
    to.vendedor_nome,
    to.valor_total,
    to.store_id,
    s.name as store_name,
    to.colaboradora_id,
    p.name as colaboradora_name,
    to.sincronizado_em,
    CASE 
        WHEN s_sales.id IS NOT NULL THEN '✅ Sincronizado para sales'
        ELSE '❌ NÃO sincronizado'
    END as status_sync
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.stores s ON s.id = to.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = to.colaboradora_id
LEFT JOIN sistemaretiradas.sales s_sales ON s_sales.tiny_order_id = to.id
WHERE 
    -- Últimas 24 horas
    to.data_pedido >= NOW() - INTERVAL '24 hours'
    -- OU procurar especificamente por Maria Helena ou pedido 1449
    OR LOWER(to.cliente_nome) LIKE '%maria%helena%'
    OR to.numero_pedido::text = '1449'
ORDER BY to.data_pedido DESC
LIMIT 20;

-- PASSO 2: Verificar vendas na tabela sales hoje
SELECT 
    'VENDAS NA TABELA SALES (hoje)' as tipo,
    s.id,
    s.data_venda,
    s.valor,
    s.qtd_pecas,
    s.store_id,
    st.name as store_name,
    s.colaboradora_id,
    p.name as colaboradora_name,
    s.tiny_order_id,
    to.numero_pedido,
    to.cliente_nome as cliente_erp,
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN '✅ Venda do ERP'
        ELSE '📝 Venda manual'
    END as origem
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.tiny_orders to ON to.id = s.tiny_order_id
WHERE 
    s.data_venda::date = CURRENT_DATE
ORDER BY s.data_venda DESC;

-- PASSO 3: Comparar: Pedidos do ERP vs Vendas sincronizadas
SELECT 
    'COMPARAÇÃO: ERP vs SALES' as tipo,
    to.numero_pedido,
    to.data_pedido,
    to.cliente_nome as cliente_erp,
    to.valor_total as valor_erp,
    to.store_id as store_id_erp,
    st.name as store_name,
    to.colaboradora_id as colab_id_erp,
    p.name as colaboradora_name,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ Existe em sales'
        ELSE '❌ NÃO existe em sales'
    END as em_sales,
    s.id as sales_id,
    s.valor as valor_sales,
    s.data_venda as data_sales,
    CASE 
        WHEN to.store_id IS NULL THEN '⚠️ ERRO: store_id NULL no tiny_orders'
        WHEN to.store_id != s.store_id THEN '⚠️ ERRO: store_id diferente'
        WHEN s.store_id IS NULL THEN '⚠️ ERRO: store_id NULL no sales'
        ELSE '✅ store_id OK'
    END as status_store_id,
    CASE 
        WHEN to.colaboradora_id IS NULL THEN '⚠️ AVISO: Sem colaboradora no ERP'
        WHEN s.colaboradora_id IS NULL THEN '⚠️ AVISO: Sem colaboradora no sales'
        WHEN to.colaboradora_id != s.colaboradora_id THEN '⚠️ ERRO: colaboradora_id diferente'
        ELSE '✅ colaboradora_id OK'
    END as status_colab_id
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.stores st ON st.id = to.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = to.colaboradora_id
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = to.id
WHERE 
    to.data_pedido >= NOW() - INTERVAL '24 hours'
    OR LOWER(to.cliente_nome) LIKE '%maria%helena%'
    OR to.numero_pedido::text = '1449'
ORDER BY to.data_pedido DESC;

-- PASSO 4: Verificar configuração da loja e colaboradoras
SELECT 
    'CONFIGURAÇÃO DA LOJA' as tipo,
    st.id,
    st.name,
    st.site_slug,
    st.admin_id,
    st.erp_ativo,
    COUNT(DISTINCT p.id) as total_colaboradoras_ativas,
    COUNT(DISTINCT CASE WHEN p.is_active = true THEN p.id END) as colaboradoras_ativas,
    COUNT(DISTINCT to.id) as total_pedidos_erp_24h,
    COUNT(DISTINCT s.id) as total_vendas_sincronizadas_24h
FROM sistemaretiradas.stores st
LEFT JOIN sistemaretiradas.profiles p ON p.store_id = st.id AND p.role = 'COLABORADORA'
LEFT JOIN sistemaretiradas.tiny_orders to ON to.store_id = st.id 
    AND to.data_pedido >= NOW() - INTERVAL '24 hours'
LEFT JOIN sistemaretiradas.sales s ON s.store_id = st.id 
    AND s.data_venda::date = CURRENT_DATE
WHERE 
    -- Procurar loja que pode ter o pedido
    st.name ILIKE '%kitsch%' 
    OR st.name ILIKE '%sacada%'
    OR EXISTS (
        SELECT 1 FROM sistemaretiradas.tiny_orders to2 
        WHERE to2.store_id = st.id 
        AND (LOWER(to2.cliente_nome) LIKE '%maria%helena%' OR to2.numero_pedido::text = '1449')
    )
GROUP BY st.id, st.name, st.site_slug, st.admin_id, st.erp_ativo;

-- PASSO 5: Verificar se há vendas do ERP sem colaboradora que não aparecem
SELECT 
    'VENDAS DO ERP SEM COLABORADORA (podem não aparecer no dashboard)' as tipo,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    st.name as store_name,
    s.colaboradora_id,
    CASE 
        WHEN s.colaboradora_id IS NULL THEN '⚠️ SEM COLABORADORA'
        WHEN p.id IS NULL THEN '⚠️ COLABORADORA NÃO ENCONTRADA'
        WHEN p.is_active = false THEN '⚠️ COLABORADORA INATIVA'
        ELSE '✅ COLABORADORA OK'
    END as status_colab,
    s.tiny_order_id,
    to.cliente_nome as cliente_erp,
    to.vendedor_nome as vendedor_erp
FROM sistemaretiradas.sales s
INNER JOIN sistemaretiradas.tiny_orders to ON to.id = s.tiny_order_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE 
    s.data_venda::date = CURRENT_DATE
    AND s.tiny_order_id IS NOT NULL
    AND (
        s.colaboradora_id IS NULL 
        OR p.id IS NULL 
        OR p.is_active = false
        OR LOWER(to.cliente_nome) LIKE '%maria%helena%'
        OR to.numero_pedido::text = '1449'
    )
ORDER BY s.data_venda DESC;

