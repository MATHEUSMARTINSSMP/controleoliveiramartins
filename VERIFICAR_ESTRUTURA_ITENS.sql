-- =============================================================================
-- Script de Verificação: Estrutura de Itens em tiny_orders
-- =============================================================================
-- Verifica se os dados de categoria e subcategoria estão sendo salvos corretamente

SET search_path TO sistemaretiradas, public;

-- 1. Verificar estrutura do campo itens
SELECT 
    id,
    tiny_id,
    numero_pedido,
    -- Extrair primeiro item para análise
    jsonb_array_length(itens::jsonb) as total_itens,
    itens::jsonb -> 0 as primeiro_item,
    -- Verificar se tem categoria e subcategoria separadas
    (itens::jsonb -> 0 ->> 'categoria') as categoria_primeiro_item,
    (itens::jsonb -> 0 ->> 'subcategoria') as subcategoria_primeiro_item,
    (itens::jsonb -> 0 ->> 'marca') as marca_primeiro_item,
    -- Verificar se tem caminhoCompleto (não deveria ter se já está separado)
    (itens::jsonb -> 0 -> 'categoria' ->> 'caminhoCompleto') as caminho_completo_se_existir,
    created_at
FROM tiny_orders
WHERE itens IS NOT NULL
  AND jsonb_array_length(itens::jsonb) > 0
ORDER BY created_at DESC
LIMIT 10;

-- 2. Contar quantos itens têm categoria e subcategoria separadas
SELECT 
    COUNT(*) as total_pedidos,
    COUNT(CASE WHEN (itens::jsonb -> 0 ->> 'categoria') IS NOT NULL THEN 1 END) as tem_categoria,
    COUNT(CASE WHEN (itens::jsonb -> 0 ->> 'subcategoria') IS NOT NULL THEN 1 END) as tem_subcategoria,
    COUNT(CASE WHEN (itens::jsonb -> 0 ->> 'categoria') IS NOT NULL 
               AND (itens::jsonb -> 0 ->> 'subcategoria') IS NOT NULL THEN 1 END) as tem_ambas_separadas,
    COUNT(CASE WHEN (itens::jsonb -> 0 -> 'categoria' ->> 'caminhoCompleto') IS NOT NULL THEN 1 END) as tem_caminho_completo
FROM tiny_orders
WHERE itens IS NOT NULL
  AND jsonb_array_length(itens::jsonb) > 0;

-- 3. Exemplo de item completo (primeiro pedido)
SELECT 
    id,
    tiny_id,
    numero_pedido,
    itens::jsonb -> 0 as item_exemplo
FROM tiny_orders
WHERE itens IS NOT NULL
  AND jsonb_array_length(itens::jsonb) > 0
ORDER BY created_at DESC
LIMIT 1;

-- 4. Verificar se há itens com categoria contendo "->" (indicando que não foi separado)
SELECT 
    id,
    tiny_id,
    numero_pedido,
    (itens::jsonb -> 0 ->> 'categoria') as categoria,
    (itens::jsonb -> 0 ->> 'subcategoria') as subcategoria
FROM tiny_orders
WHERE itens IS NOT NULL
  AND jsonb_array_length(itens::jsonb) > 0
  AND (itens::jsonb -> 0 ->> 'categoria') LIKE '%>%'
ORDER BY created_at DESC
LIMIT 10;

