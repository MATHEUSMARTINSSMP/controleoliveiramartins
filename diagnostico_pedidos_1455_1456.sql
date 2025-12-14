-- ============================================================
-- DIAGNÓSTICO: PEDIDOS 1455 E 1456 DO TINY ERP
-- ============================================================
-- Loja: Sacada | Oh, Boy
-- Store ID: cee7d359-0240-4131-87a2-21ae44bd1bb4
-- 
-- Pedidos que NÃO aparecem no EleveaOne:
-- - Pedido 1456 - Adelaide Pereira de Oliveira - R$ 568,10 (13/12/2025)
-- - Pedido 1455 - Patricia Cunha Ribeiro - R$ 1.025,00 (13/12/2025)
-- ============================================================

-- 1. VERIFICAR SE PEDIDOS EXISTEM NA TABELA tiny_orders
SELECT 
    '1. PEDIDOS NO TINY_ORDERS' as etapa,
    t_ord.id,
    t_ord.tiny_id,
    t_ord.numero_pedido,
    t_ord.data_pedido,
    t_ord.cliente_nome,
    t_ord.vendedor_nome,
    t_ord.valor_total,
    t_ord.situacao,
    t_ord.colaboradora_id,
    t_ord.store_id,
    t_ord.sync_at,
    t_ord.created_at
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.numero_pedido IN ('1455', '1456')
   OR t_ord.numero_pedido::text IN ('1455', '1456')
   OR (LOWER(t_ord.cliente_nome) LIKE '%adelaide%' OR LOWER(t_ord.cliente_nome) LIKE '%patricia%cunha%')
ORDER BY t_ord.numero_pedido;

-- 2. VERIFICAR SE EXISTEM VENDAS CRIADAS A PARTIR DESSES PEDIDOS
SELECT 
    '2. VENDAS NA TABELA SALES' as etapa,
    s.id,
    s.data_venda,
    s.valor,
    s.store_id,
    s.colaboradora_id,
    s.tiny_order_id,
    s.cliente_nome,
    s.forma_pagamento,
    s.status_pagamento,
    t_ord.numero_pedido as numero_pedido_tiny
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.tiny_orders t_ord ON t_ord.id = s.tiny_order_id
WHERE t_ord.numero_pedido IN ('1455', '1456')
   OR s.cliente_nome LIKE '%Adelaide%'
   OR s.cliente_nome LIKE '%Patricia Cunha%'
ORDER BY s.data_venda DESC;

-- 3. LISTAR ÚLTIMOS PEDIDOS SINCRONIZADOS DA LOJA (para comparação)
SELECT 
    '3. ÚLTIMOS 20 PEDIDOS DA LOJA' as etapa,
    t_ord.numero_pedido,
    t_ord.data_pedido,
    t_ord.cliente_nome,
    t_ord.vendedor_nome,
    t_ord.valor_total,
    t_ord.colaboradora_id,
    t_ord.situacao,
    t_ord.sync_at
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
ORDER BY t_ord.numero_pedido::int DESC NULLS LAST
LIMIT 20;

-- 4. VERIFICAR MAPEAMENTO DE VENDEDORES (para Adelaide e Patricia)
SELECT 
    '4. VENDEDORES SEM MAPEAMENTO' as etapa,
    t_ord.vendedor_nome,
    COUNT(*) as total_pedidos,
    COUNT(CASE WHEN t_ord.colaboradora_id IS NULL THEN 1 END) as sem_mapeamento,
    MAX(t_ord.numero_pedido::int) as ultimo_pedido,
    MAX(t_ord.data_pedido) as ultima_data
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
GROUP BY t_ord.vendedor_nome
HAVING COUNT(CASE WHEN t_ord.colaboradora_id IS NULL THEN 1 END) > 0
ORDER BY sem_mapeamento DESC, ultimo_pedido DESC;

-- 5. VERIFICAR COLABORADORAS DA LOJA
SELECT 
    '5. COLABORADORAS DA LOJA' as etapa,
    p.id,
    p.name,
    p.email,
    p.tiny_vendedor_id,
    p.is_active,
    p.role
FROM sistemaretiradas.profiles p
WHERE p.role = 'COLABORADORA'
    AND p.is_active = true
    AND (
        p.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text
        OR p.store_default = 'Sacada | Oh, Boy'
    )
ORDER BY p.name;

-- 6. VERIFICAR SE O PROBLEMA É SITUAÇÃO DO PEDIDO NO TINY
-- (Este diagnóstico é informativo - o status real precisa ser verificado no Tiny ERP)
SELECT 
    '6. RESUMO DE SITUAÇÕES DOS PEDIDOS' as etapa,
    t_ord.situacao,
    CASE 
        WHEN t_ord.situacao = 0 THEN 'Pendente'
        WHEN t_ord.situacao = 1 THEN 'Aprovado'
        WHEN t_ord.situacao = 2 THEN 'Cancelado'
        WHEN t_ord.situacao = 3 THEN 'Faturado'
        WHEN t_ord.situacao = 4 THEN 'Entregue'
        WHEN t_ord.situacao = 5 THEN 'Preparando'
        ELSE 'Desconhecido'
    END as situacao_descricao,
    COUNT(*) as total_pedidos
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
    AND t_ord.data_pedido >= '2025-12-01'
GROUP BY t_ord.situacao
ORDER BY t_ord.situacao;

-- 7. DIAGNÓSTICO FINAL: Verificar se pedidos específicos chegaram ao sistema
SELECT 
    '7. DIAGNÓSTICO FINAL' as etapa,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.tiny_orders 
            WHERE numero_pedido = '1455' 
            AND store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
        ) THEN '✅ Pedido 1455 EXISTE no tiny_orders'
        ELSE '❌ Pedido 1455 NÃO EXISTE no tiny_orders'
    END as pedido_1455,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.tiny_orders 
            WHERE numero_pedido = '1456' 
            AND store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
        ) THEN '✅ Pedido 1456 EXISTE no tiny_orders'
        ELSE '❌ Pedido 1456 NÃO EXISTE no tiny_orders'
    END as pedido_1456,
    (SELECT MAX(numero_pedido::int) FROM sistemaretiradas.tiny_orders 
     WHERE store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid) as ultimo_pedido_sincronizado,
    (SELECT MAX(sync_at) FROM sistemaretiradas.tiny_orders 
     WHERE store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid) as ultima_sincronizacao;
