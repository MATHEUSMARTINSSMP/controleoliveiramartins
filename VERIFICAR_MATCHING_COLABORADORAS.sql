-- ============================================================================
-- SCRIPT: Verificar Matching de Colaboradoras
-- Descrição: Queries para verificar se colaboradoras estão sendo casadas corretamente
-- ============================================================================

-- ============================================================================
-- 1. VER TODAS AS COLABORADORAS E SEUS DADOS PARA MATCHING
-- ============================================================================

SELECT 
    p.id as colaboradora_id,
    p.name as nome_supabase,
    p.email as email_supabase,
    p.cpf as cpf_supabase,
    s.name as loja,
    p.active as ativa
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
ORDER BY s.name, p.name;

-- ============================================================================
-- 2. VER PEDIDOS E SEUS MATCHES DE COLABORADORAS
-- ============================================================================

SELECT 
    to.id as pedido_id,
    to.numero_pedido,
    to.data_pedido,
    to.vendedor_nome as vendedor_tiny,
    to.vendedor_tiny_id,
    to.colaboradora_id,
    p.name as colaboradora_match,
    p.cpf as colaboradora_cpf,
    p.email as colaboradora_email,
    s.name as loja,
    CASE 
        WHEN to.colaboradora_id IS NOT NULL THEN '✅ MATCH'
        WHEN to.vendedor_nome IS NOT NULL THEN '❌ SEM MATCH'
        ELSE '⚪ SEM VENDEDOR'
    END as status_match
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.profiles p ON to.colaboradora_id = p.id
LEFT JOIN sistemaretiradas.stores s ON to.store_id = s.id
WHERE to.vendedor_nome IS NOT NULL
ORDER BY to.created_at DESC
LIMIT 100;

-- ============================================================================
-- 3. ESTATÍSTICAS DE MATCHING
-- ============================================================================

-- Total de pedidos com match
SELECT 
    'Total com Match' as tipo,
    COUNT(*) as total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NOT NULL

UNION ALL

-- Total de pedidos sem match (mas com vendedor)
SELECT 
    'Total sem Match' as tipo,
    COUNT(*) as total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NULL
  AND vendedor_nome IS NOT NULL

UNION ALL

-- Total de colaboradoras únicas matchadas
SELECT 
    'Colaboradoras Únicas Matchadas' as tipo,
    COUNT(DISTINCT colaboradora_id) as total
FROM sistemaretiradas.tiny_orders
WHERE colaboradora_id IS NOT NULL;

-- ============================================================================
-- 4. PEDIDOS SEM MATCH (VERIFICAR POR QUÊ)
-- ============================================================================

SELECT 
    to.numero_pedido,
    to.vendedor_nome as vendedor_tiny,
    to.vendedor_tiny_id,
    to.data_pedido,
    s.name as loja,
    COUNT(*) as total_pedidos
FROM sistemaretiradas.tiny_orders to
LEFT JOIN sistemaretiradas.stores s ON to.store_id = s.id
WHERE to.colaboradora_id IS NULL
  AND to.vendedor_nome IS NOT NULL
GROUP BY to.numero_pedido, to.vendedor_nome, to.vendedor_tiny_id, to.data_pedido, s.name
ORDER BY total_pedidos DESC, to.data_pedido DESC
LIMIT 50;

-- ============================================================================
-- 5. COMPARAR VENDEDORES DO TINY COM COLABORADORAS DO SUPABASE
-- ============================================================================

-- Vendedores únicos do Tiny (últimos 30 dias)
WITH vendedores_tiny AS (
    SELECT DISTINCT
        vendedor_nome,
        vendedor_tiny_id,
        store_id
    FROM sistemaretiradas.tiny_orders
    WHERE vendedor_nome IS NOT NULL
      AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
    vt.vendedor_nome as vendedor_tiny,
    vt.vendedor_tiny_id,
    s.name as loja,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.tiny_orders to2
            WHERE to2.vendedor_nome = vt.vendedor_nome
              AND to2.store_id = vt.store_id
              AND to2.colaboradora_id IS NOT NULL
            LIMIT 1
        ) THEN '✅ TEM MATCH'
        ELSE '❌ SEM MATCH'
    END as tem_match,
    (
        SELECT p.name 
        FROM sistemaretiradas.tiny_orders to2
        JOIN sistemaretiradas.profiles p ON to2.colaboradora_id = p.id
        WHERE to2.vendedor_nome = vt.vendedor_nome
          AND to2.store_id = vt.store_id
          AND to2.colaboradora_id IS NOT NULL
        LIMIT 1
    ) as colaboradora_match
FROM vendedores_tiny vt
JOIN sistemaretiradas.stores s ON vt.store_id = s.id
ORDER BY loja, vendedor_tiny;

-- ============================================================================
-- 6. VERIFICAR COLABORADORAS QUE DEVERIAM TER MATCH MAS NÃO TÊM
-- ============================================================================

-- Colaboradoras que existem mas pedidos não estão sendo matchados
SELECT 
    p.name as colaboradora,
    p.cpf,
    p.email,
    s.name as loja,
    COUNT(DISTINCT to.id) as pedidos_sem_match
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
LEFT JOIN sistemaretiradas.tiny_orders to ON (
    to.store_id = p.store_id
    AND to.vendedor_nome IS NOT NULL
    AND to.colaboradora_id IS NULL
    -- Tentar encontrar por nome similar
    AND LOWER(REGEXP_REPLACE(to.vendedor_nome, '[^a-z ]', '', 'g')) = 
        LOWER(REGEXP_REPLACE(p.name, '[^a-z ]', '', 'g'))
)
WHERE p.role = 'COLABORADORA'
  AND p.active = true
GROUP BY p.id, p.name, p.cpf, p.email, s.name
HAVING COUNT(DISTINCT to.id) > 0
ORDER BY pedidos_sem_match DESC;

-- ============================================================================
-- 7. NORMALIZAR CPF PARA COMPARAÇÃO (HELPER)
-- ============================================================================

-- Função helper para normalizar CPF (remover formatação)
-- SELECT REGEXP_REPLACE('123.456.789-00', '\D', '', 'g') as cpf_normalizado;

-- ============================================================================
-- 8. VERIFICAR MATCHES POTENCIAIS POR CPF
-- ============================================================================

-- Esta query mostra vendedores do Tiny que PODERIAM ser matchados
-- se tivessem CPF cadastrado e igual ao da colaboradora
SELECT 
    to.vendedor_nome,
    to.vendedor_tiny_id,
    s.name as loja,
    'Pendente verificação de CPF no Tiny' as observacao
FROM sistemaretiradas.tiny_orders to
JOIN sistemaretiradas.stores s ON to.store_id = s.id
WHERE to.colaboradora_id IS NULL
  AND to.vendedor_nome IS NOT NULL
  AND NOT EXISTS (
      -- Verificar se há colaboradora com nome similar
      SELECT 1 FROM sistemaretiradas.profiles p
      WHERE p.store_id = to.store_id
        AND p.role = 'COLABORADORA'
        AND p.active = true
        AND LOWER(REGEXP_REPLACE(p.name, '[^a-z ]', '', 'g')) = 
            LOWER(REGEXP_REPLACE(to.vendedor_nome, '[^a-z ]', '', 'g'))
  )
GROUP BY to.vendedor_nome, to.vendedor_tiny_id, s.name
ORDER BY loja, to.vendedor_nome;

