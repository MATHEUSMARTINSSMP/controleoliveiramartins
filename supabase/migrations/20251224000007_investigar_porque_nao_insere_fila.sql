-- ============================================================================
-- INVESTIGAR: POR QUE MENSAGENS DE VENDA NÃO ESTÃO SENDO INSERIDAS NA FILA
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Verificar se há vendas sendo criadas e por que não geram notificações
-- ============================================================================

-- 1. VERIFICAR VENDAS CRIADAS NA LOUNGERIE (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    s.id as sale_id,
    s.valor,
    s.qtd_pecas,
    s.data_venda,
    s.created_at,
    s.colaboradora_id,
    c.name as colaboradora_nome,
    s.store_id,
    st.name as store_name,
    s.tiny_order_id,
    s.external_order_id,
    s.order_source
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
WHERE s.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 20;

-- 2. VERIFICAR TODAS AS MENSAGENS NA FILA PARA LOUNGERIE (SEM FILTRO DE TIPO)
-- ============================================================================
-- Pode ser que estejam sendo inseridas mas sem notification_type no metadata
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.sent_at,
    q.error_message,
    q.message_type,
    q.priority,
    q.metadata,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'source' as source,
    s.name as store_name
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 50;

-- 3. VERIFICAR VENDAS DO TINY ORDERS PARA LOUNGERIE (ÚLTIMAS 24H)
-- ============================================================================
-- Pode ser que o sync-tiny-orders não esteja detectando novas vendas
SELECT 
    to.id,
    to.numero_pedido,
    to.data_pedido,
    to.valor_total,
    to.vendedor_nome,
    to.colaboradora_id,
    c.name as colaboradora_nome,
    to.store_id,
    st.name as store_name,
    to.created_at,
    to.updated_at,
    CASE 
        WHEN to.created_at = to.updated_at THEN 'NOVO'
        ELSE 'ATUALIZADO'
    END as tipo_operacao
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.profiles c ON c.id = to.colaboradora_id
LEFT JOIN sistemaretiradas.stores st ON st.id = to.store_id
WHERE to.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
AND (
    to.created_at >= NOW() - INTERVAL '24 hours'
    OR to.updated_at >= NOW() - INTERVAL '24 hours'
)
ORDER BY GREATEST(to.created_at, to.updated_at) DESC
LIMIT 20;

-- 4. VERIFICAR SE HÁ MENSAGENS DE VENDA COM SOURCE DIFERENTE
-- ============================================================================
-- Pode ser que estejam sendo inseridas com source diferente
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.metadata->>'source' as source,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'order_id' as order_id,
    q.metadata->>'colaboradora' as colaboradora,
    LEFT(q.message, 100) as message_preview,
    s.name as store_name
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
AND (
    q.metadata->>'source' = 'sync-tiny-orders'
    OR q.metadata->>'source' = 'loja-dashboard'
    OR q.metadata->>'source' LIKE '%venda%'
    OR q.metadata->>'source' LIKE '%sale%'
)
AND q.created_at >= NOW() - INTERVAL '7 days' -- Últimos 7 dias
ORDER BY q.created_at DESC
LIMIT 50;

-- 5. VERIFICAR STATUS DO WHATSAPP DA LOUNGERIE (CORRIGIR SE NECESSÁRIO)
-- ============================================================================
SELECT 
    id,
    name,
    whatsapp_ativo,
    whatsapp_connection_status,
    whatsapp_connected_at,
    uazapi_token,
    uazapi_instance_id
FROM sistemaretiradas.stores
WHERE id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'; -- Loungerie

-- 6. VERIFICAR SE HÁ VENDAS CRIADAS VIA LOJADASHBOARD (ÚLTIMAS 24H)
-- ============================================================================
-- Verificar se há vendas criadas manualmente no dashboard
SELECT 
    s.id,
    s.valor,
    s.data_venda,
    s.created_at,
    s.tiny_order_id,
    s.external_order_id,
    s.order_source,
    CASE 
        WHEN s.tiny_order_id IS NOT NULL THEN 'TINY_ORDER'
        WHEN s.external_order_id IS NOT NULL THEN 'EXTERNAL_ORDER'
        WHEN s.order_source IS NOT NULL THEN 'ORDER_SOURCE: ' || s.order_source
        ELSE 'MANUAL (LojaDashboard)'
    END as origem_venda,
    c.name as colaboradora_nome
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles c ON c.id = s.colaboradora_id
WHERE s.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
AND s.created_at >= NOW() - INTERVAL '24 hours'
AND (
    s.tiny_order_id IS NULL 
    AND s.external_order_id IS NULL
    AND s.order_source IS NULL
)
ORDER BY s.created_at DESC;

-- 7. VERIFICAR LOGS DO SYNC-TINY-ORDERS (SE HOUVER)
-- ============================================================================
-- Verificar se há algum log ou erro relacionado ao sync
SELECT 
    'Verifique os logs do Netlify Function sync-tiny-orders-background' as instrucao,
    'Acesse: https://app.netlify.com/sites/[seu-site]/functions/sync-tiny-orders-background' as url;

