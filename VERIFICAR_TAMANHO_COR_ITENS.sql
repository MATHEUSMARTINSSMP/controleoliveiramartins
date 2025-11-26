-- =============================================================================
-- VERIFICAR SE OS ITENS TÊM TAMANHO E COR SALVOS
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Verificar itens de pedidos recentes (últimos 30 dias)
SELECT 
    '📊 ANÁLISE DE ITENS' as categoria,
    COUNT(*) as total_itens,
    COUNT(*) FILTER (WHERE (itens::jsonb->0->>'tamanho') IS NOT NULL AND (itens::jsonb->0->>'tamanho') != '') as tem_tamanho,
    COUNT(*) FILTER (WHERE (itens::jsonb->0->>'cor') IS NOT NULL AND (itens::jsonb->0->>'cor') != '') as tem_cor,
    COUNT(*) FILTER (
        WHERE (itens::jsonb->0->>'tamanho') IS NOT NULL 
        AND (itens::jsonb->0->>'cor') IS NOT NULL 
        AND (itens::jsonb->0->>'tamanho') != ''
        AND (itens::jsonb->0->>'cor') != ''
    ) as tem_ambos,
    ROUND(
        COUNT(*) FILTER (WHERE (itens::jsonb->0->>'tamanho') IS NOT NULL AND (itens::jsonb->0->>'tamanho') != '')::numeric 
        / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as percentual_com_tamanho,
    ROUND(
        COUNT(*) FILTER (WHERE (itens::jsonb->0->>'cor') IS NOT NULL AND (itens::jsonb->0->>'cor') != '')::numeric 
        / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as percentual_com_cor
FROM tiny_orders
WHERE data_pedido >= NOW() - INTERVAL '30 days'
AND itens IS NOT NULL
AND itens != '[]'::jsonb
AND itens != 'null'::jsonb;

-- Mostrar exemplos de itens sem tamanho/cor
SELECT 
    '📋 EXEMPLOS SEM TAMANHO/COR' as categoria,
    tiny_id,
    numero_pedido,
    data_pedido,
    situacao,
    jsonb_array_length(itens::jsonb) as quantidade_itens,
    itens::jsonb->0->>'descricao' as primeiro_item_descricao,
    itens::jsonb->0->>'codigo' as primeiro_item_codigo,
    itens::jsonb->0->>'tamanho' as tamanho,
    itens::jsonb->0->>'cor' as cor,
    itens::jsonb->0->>'marca' as marca,
    itens::jsonb->0->>'categoria' as categoria
FROM tiny_orders
WHERE data_pedido >= NOW() - INTERVAL '30 days'
AND itens IS NOT NULL
AND itens != '[]'::jsonb
AND itens != 'null'::jsonb
AND (
    (itens::jsonb->0->>'tamanho') IS NULL 
    OR (itens::jsonb->0->>'tamanho') = ''
    OR (itens::jsonb->0->>'cor') IS NULL 
    OR (itens::jsonb->0->>'cor') = ''
)
LIMIT 10;

-- Mostrar exemplos de itens COM tamanho/cor (para comparar)
SELECT 
    '✅ EXEMPLOS COM TAMANHO/COR' as categoria,
    tiny_id,
    numero_pedido,
    data_pedido,
    itens::jsonb->0->>'descricao' as primeiro_item_descricao,
    itens::jsonb->0->>'codigo' as primeiro_item_codigo,
    itens::jsonb->0->>'tamanho' as tamanho,
    itens::jsonb->0->>'cor' as cor,
    itens::jsonb->0->>'marca' as marca
FROM tiny_orders
WHERE data_pedido >= NOW() - INTERVAL '30 days'
AND itens IS NOT NULL
AND itens != '[]'::jsonb
AND itens != 'null'::jsonb
AND (itens::jsonb->0->>'tamanho') IS NOT NULL
AND (itens::jsonb->0->>'tamanho') != ''
AND (itens::jsonb->0->>'cor') IS NOT NULL
AND (itens::jsonb->0->>'cor') != ''
LIMIT 10;
