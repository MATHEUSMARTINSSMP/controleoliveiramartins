-- DIAGNOSTICO: Por que a venda 1439 (Manuela, R$ 2.397,00) nao aparece no dashboard?

-- 1. Verificar se o pedido 1439 existe na tabela tiny_orders
SELECT 
    id,
    numero_pedido,
    store_id,
    colaboradora_id,
    vendedor_nome,
    valor_total,
    data_pedido,
    created_at
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido = 1439
OR numero_pedido = '1439';

-- 2. Verificar se existe uma colaboradora chamada "Manuela"
SELECT 
    id,
    name,
    role,
    active,
    store_id,
    store_default
FROM sistemaretiradas.profiles
WHERE name ILIKE '%Manuela%'
AND role = 'COLABORADORA';

-- 3. Verificar todos os vendedores unicos nos tiny_orders que NAO tem colaboradora_id mapeada
SELECT DISTINCT
    vendedor_nome,
    COUNT(*) as qtd_pedidos,
    SUM(valor_total) as valor_total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NULL
AND vendedor_nome IS NOT NULL
GROUP BY vendedor_nome
ORDER BY qtd_pedidos DESC;

-- 4. Verificar se existe venda para o pedido 1439
SELECT 
    s.id,
    s.colaboradora_id,
    s.valor,
    s.data_venda,
    s.tiny_order_id,
    p.name as colaboradora_nome
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.tiny_order_id IN (
    SELECT id FROM sistemaretiradas.tiny_orders WHERE numero_pedido = 1439
);

-- 5. Verificar mapeamento de vendedores Tiny para colaboradoras
SELECT 
    tiny_seller_name,
    colaboradora_id,
    p.name as colaboradora_nome,
    store_id
FROM sistemaretiradas.tiny_seller_mapping m
LEFT JOIN sistemaretiradas.profiles p ON p.id = m.colaboradora_id
ORDER BY tiny_seller_name;

-- 6. Se precisar mapear Manuela, execute:
-- INSERT INTO sistemaretiradas.tiny_seller_mapping (tiny_seller_name, colaboradora_id, store_id)
-- SELECT 'Manuela', id, store_id 
-- FROM sistemaretiradas.profiles 
-- WHERE name ILIKE '%Manuela%' AND role = 'COLABORADORA' AND active = true
-- LIMIT 1;

-- 7. Depois de mapear, reprocessar pedidos sem colaboradora:
-- SELECT sistemaretiradas.criar_vendas_de_tiny_orders();
