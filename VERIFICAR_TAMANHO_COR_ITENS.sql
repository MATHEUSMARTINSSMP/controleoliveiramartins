-- =============================================================================
-- VERIFICAR SE OS ITENS TÊM TAMANHO E COR SALVOS
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Verificar itens de pedidos recentes (últimos 30 dias)
-- ✅ CORREÇÃO: Verificar se itens é um array antes de usar jsonb_array_length
WITH pedidos_com_itens AS (
    SELECT 
        id,
        tiny_id,
        numero_pedido,
        data_pedido,
        situacao,
        itens,
        CASE 
            WHEN jsonb_typeof(itens::jsonb) = 'array' THEN jsonb_array_length(itens::jsonb)
            ELSE 0
        END as quantidade_itens
    FROM tiny_orders
    WHERE data_pedido >= NOW() - INTERVAL '30 days'
    AND itens IS NOT NULL
    AND itens != 'null'::jsonb
    AND jsonb_typeof(itens::jsonb) = 'array'
    AND jsonb_array_length(itens::jsonb) > 0
)
SELECT 
    '📊 ANÁLISE DE ITENS' as categoria,
    COUNT(*) as total_pedidos,
    SUM(quantidade_itens) as total_itens,
    COUNT(*) FILTER (
        WHERE jsonb_typeof(itens::jsonb) = 'array' 
        AND jsonb_array_length(itens::jsonb) > 0
        AND (itens::jsonb->0->>'tamanho') IS NOT NULL 
        AND (itens::jsonb->0->>'tamanho') != ''
    ) as pedidos_com_tamanho,
    COUNT(*) FILTER (
        WHERE jsonb_typeof(itens::jsonb) = 'array' 
        AND jsonb_array_length(itens::jsonb) > 0
        AND (itens::jsonb->0->>'cor') IS NOT NULL 
        AND (itens::jsonb->0->>'cor') != ''
    ) as pedidos_com_cor,
    COUNT(*) FILTER (
        WHERE jsonb_typeof(itens::jsonb) = 'array' 
        AND jsonb_array_length(itens::jsonb) > 0
        AND (itens::jsonb->0->>'tamanho') IS NOT NULL 
        AND (itens::jsonb->0->>'cor') IS NOT NULL 
        AND (itens::jsonb->0->>'tamanho') != ''
        AND (itens::jsonb->0->>'cor') != ''
    ) as pedidos_com_ambos,
    ROUND(
        COUNT(*) FILTER (
            WHERE jsonb_typeof(itens::jsonb) = 'array' 
            AND jsonb_array_length(itens::jsonb) > 0
            AND (itens::jsonb->0->>'tamanho') IS NOT NULL 
            AND (itens::jsonb->0->>'tamanho') != ''
        )::numeric 
        / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as percentual_com_tamanho,
    ROUND(
        COUNT(*) FILTER (
            WHERE jsonb_typeof(itens::jsonb) = 'array' 
            AND jsonb_array_length(itens::jsonb) > 0
            AND (itens::jsonb->0->>'cor') IS NOT NULL 
            AND (itens::jsonb->0->>'cor') != ''
        )::numeric 
        / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as percentual_com_cor
FROM pedidos_com_itens;

-- Mostrar exemplos de itens sem tamanho/cor
SELECT 
    '📋 EXEMPLOS SEM TAMANHO/COR' as categoria,
    tiny_id,
    numero_pedido,
    data_pedido,
    situacao,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' THEN jsonb_array_length(itens::jsonb)
        ELSE 0
    END as quantidade_itens,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'descricao'
        ELSE NULL
    END as primeiro_item_descricao,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'codigo'
        ELSE NULL
    END as primeiro_item_codigo,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'tamanho'
        ELSE NULL
    END as tamanho,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'cor'
        ELSE NULL
    END as cor,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'marca'
        ELSE NULL
    END as marca,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'categoria'
        ELSE NULL
    END as categoria
FROM tiny_orders
WHERE data_pedido >= NOW() - INTERVAL '30 days'
AND itens IS NOT NULL
AND itens != 'null'::jsonb
AND jsonb_typeof(itens::jsonb) = 'array'
AND jsonb_array_length(itens::jsonb) > 0
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
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'descricao'
        ELSE NULL
    END as primeiro_item_descricao,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'codigo'
        ELSE NULL
    END as primeiro_item_codigo,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'tamanho'
        ELSE NULL
    END as tamanho,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'cor'
        ELSE NULL
    END as cor,
    CASE 
        WHEN jsonb_typeof(itens::jsonb) = 'array' AND jsonb_array_length(itens::jsonb) > 0 
        THEN itens::jsonb->0->>'marca'
        ELSE NULL
    END as marca
FROM tiny_orders
WHERE data_pedido >= NOW() - INTERVAL '30 days'
AND itens IS NOT NULL
AND itens != 'null'::jsonb
AND jsonb_typeof(itens::jsonb) = 'array'
AND jsonb_array_length(itens::jsonb) > 0
AND (itens::jsonb->0->>'tamanho') IS NOT NULL
AND (itens::jsonb->0->>'tamanho') != ''
AND (itens::jsonb->0->>'cor') IS NOT NULL
AND (itens::jsonb->0->>'cor') != ''
LIMIT 10;
