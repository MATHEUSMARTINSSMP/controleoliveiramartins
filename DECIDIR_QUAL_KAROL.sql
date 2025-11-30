-- ============================================================================
-- SCRIPT: Decidir Qual "Karol" é a Correta
-- Descrição: Queries para identificar qual colaboradora corresponde ao vendedor "Karol" do Tiny
-- ============================================================================

-- ============================================================================
-- 1. VER PEDIDOS DO VENDEDOR "Karol" DO TINY (para comparar)
-- ============================================================================

SELECT 
    ped.numero_pedido,
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    ped.data_pedido,
    ped.colaboradora_id,
    p.name as colaboradora_match_atual,
    s.name as loja
FROM sistemaretiradas.tiny_orders ped
LEFT JOIN sistemaretiradas.profiles p ON ped.colaboradora_id = p.id
JOIN sistemaretiradas.stores s ON ped.store_id = s.id
WHERE ped.vendedor_tiny_id = '908189863'
  AND ped.vendedor_nome ILIKE '%karol%'
ORDER BY ped.created_at DESC
LIMIT 50;

-- ============================================================================
-- 2. COMPARAR NOMES: Qual é mais similar a "Karol"?
-- ============================================================================

SELECT 
    name as colaboradora,
    cpf,
    email,
    tiny_vendedor_id,
    -- Similaridade com "Karol"
    CASE 
        WHEN name ILIKE '%karol%' AND name ILIKE '%karolayne%' THEN '✅ CONTÉM "Karol" + "Karolayne"'
        WHEN name ILIKE '%karol%' AND name ILIKE '%karolainy%' THEN '✅ CONTÉM "Karol" + "Karolainy"'
        WHEN name ILIKE '%karol%' THEN '✅ CONTÉM "Karol"'
        ELSE '❌ NÃO CONTÉM "Karol"'
    END as similaridade,
    -- Nome normalizado para comparação
    LOWER(REGEXP_REPLACE(name, '[^a-z ]', '', 'g')) as nome_normalizado
FROM sistemaretiradas.profiles
WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
  AND role = 'COLABORADORA'
ORDER BY similaridade DESC;

-- ============================================================================
-- 3. VER SE ALGUMA JÁ TEVE MATCH EM ALGUM MOMENTO (mesmo que removido depois)
-- ============================================================================

-- Ver histórico de matches (se houver logs ou outra forma de rastrear)
SELECT 
    ped.id as pedido_id,
    ped.numero_pedido,
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    ped.colaboradora_id,
    p.name as colaboradora_match,
    ped.created_at,
    ped.updated_at
FROM sistemaretiradas.tiny_orders ped
LEFT JOIN sistemaretiradas.profiles p ON ped.colaboradora_id = p.id
WHERE ped.vendedor_tiny_id = '908189863'
ORDER BY ped.created_at DESC;

-- ============================================================================
-- 4. VER COLABORADORAS E COMPARAR COM NOME DO VENDEDOR TINY
-- ============================================================================

-- Comparar nome do vendedor Tiny "Karol" com nomes das colaboradoras
SELECT 
    'VENDEDOR TINY' as origem,
    'Karol' as nome,
    '908189863' as id_tiny,
    NULL as cpf,
    NULL as email
UNION ALL
SELECT 
    'COLABORADORA' as origem,
    name as nome,
    tiny_vendedor_id as id_tiny,
    cpf,
    email
FROM sistemaretiradas.profiles
WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
  AND role = 'COLABORADORA'
ORDER BY origem, nome;

-- ============================================================================
-- 5. SUGESTÃO: Remover ID de ambas e mapear corretamente depois
-- ============================================================================

-- Opção A: Remover ID de ambas (para mapear depois)
-- UPDATE sistemaretiradas.profiles
-- SET tiny_vendedor_id = NULL
-- WHERE name IN ('Karolainy Barbosa Tavares', 'Karolayne Rodrigues Araújo')
--   AND role = 'COLABORADORA';

-- Opção B: Manter apenas uma (se souber qual é)
-- UPDATE sistemaretiradas.profiles
-- SET tiny_vendedor_id = NULL
-- WHERE name = 'Karolayne Rodrigues Araújo'  -- ou 'Karolainy Barbosa Tavares'
--   AND role = 'COLABORADORA';

-- ============================================================================
-- 6. VER COMO O VENDEDOR "Karol" APARECE NO TINY (nome completo)
-- ============================================================================

-- Ver todas as variações do nome "Karol" nos pedidos
SELECT DISTINCT
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    COUNT(*) as total_pedidos,
    MIN(ped.created_at) as primeiro_pedido,
    MAX(ped.created_at) as ultimo_pedido
FROM sistemaretiradas.tiny_orders ped
WHERE ped.vendedor_tiny_id = '908189863'
GROUP BY ped.vendedor_nome, ped.vendedor_tiny_id
ORDER BY total_pedidos DESC;

-- ============================================================================
-- 7. VERIFICAR SE HÁ OUTRA COLABORADORA QUE DEVERIA SER A "Karol"
-- ============================================================================

-- Ver se há alguma colaboradora com nome mais próximo de "Karol"
SELECT 
    name as colaboradora,
    cpf,
    email,
    tiny_vendedor_id,
    CASE 
        WHEN name ILIKE 'karol%' THEN '✅ COMEÇA COM "Karol"'
        WHEN name ILIKE '%karol%' THEN '✅ CONTÉM "Karol"'
        ELSE '❌ NÃO TEM "Karol"'
    END as similaridade
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
  AND active = true
  AND (
      name ILIKE '%karol%'
      OR name ILIKE '%carol%'
  )
ORDER BY similaridade DESC, name;

