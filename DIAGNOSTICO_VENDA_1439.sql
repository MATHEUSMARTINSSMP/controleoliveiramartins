-- =====================================================================
-- DIAGNOSTICO: Por que a venda 1439 (Manuela, R$ 2.397,00) nao aparece?
-- =====================================================================

-- PASSO 1: Verificar se o pedido 1439 existe e qual o store_id
SELECT 
    id,
    numero_pedido,
    store_id,
    colaboradora_id,
    vendedor_nome,
    vendedor_tiny_id,
    valor_total,
    data_pedido
FROM sistemaretiradas.tiny_orders
WHERE numero_pedido = 1439;

-- PASSO 2: Listar TODAS as colaboradoras ativas do sistema
SELECT 
    id,
    name,
    store_id,
    store_default,
    tiny_vendedor_id,
    cpf,
    email
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' 
AND active = true
ORDER BY name;

-- PASSO 3: Verificar vendedores do Tiny que NAO foram mapeados (nao tem colaboradora_id)
SELECT DISTINCT
    vendedor_nome,
    vendedor_tiny_id,
    store_id,
    COUNT(*) as qtd_pedidos,
    SUM(valor_total) as valor_total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NULL
AND vendedor_nome IS NOT NULL
GROUP BY vendedor_nome, vendedor_tiny_id, store_id
ORDER BY qtd_pedidos DESC;

-- PASSO 4: Verificar se Manuela existe (qualquer variacao do nome)
SELECT 
    id,
    name,
    store_id,
    tiny_vendedor_id,
    active
FROM sistemaretiradas.profiles
WHERE name ILIKE '%Manuela%'
AND role = 'COLABORADORA';

-- =====================================================================
-- SOLUCAO: Mapear Manuela para o ID do vendedor Tiny
-- =====================================================================

-- OPCAO A: Se Manuela EXISTE mas nao tem tiny_vendedor_id, atualize:
-- (Substitua 'ID_DO_VENDEDOR_TINY' pelo valor de vendedor_tiny_id do PASSO 3)
-- UPDATE sistemaretiradas.profiles 
-- SET tiny_vendedor_id = 'ID_DO_VENDEDOR_TINY'
-- WHERE name ILIKE '%Manuela%' AND role = 'COLABORADORA';

-- OPCAO B: Se Manuela existe mas com store_id diferente, atualize:
-- (Substitua 'ID_LOJA_CORRETA' pelo store_id do pedido 1439)
-- UPDATE sistemaretiradas.profiles 
-- SET store_id = 'ID_LOJA_CORRETA'
-- WHERE name ILIKE '%Manuela%' AND role = 'COLABORADORA';

-- PASSO 5: Depois de corrigir, force ressincronizacao:
-- Clique em "Sincronizar Semana" ou "Sincronizacao Total" no dashboard ERP

-- PASSO 6: Reprocessar pedidos para criar vendas
SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders();
