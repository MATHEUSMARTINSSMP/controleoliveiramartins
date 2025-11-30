-- ============================================================================
-- SCRIPT: Mapear Colaboradoras com IDs do Tiny ERP
-- Descrição: Atualiza colaboradoras com seus vendedor_tiny_id para matching automático
-- ============================================================================

-- IMPORTANTE: Execute estas queries APÓS executar a migration que adiciona o campo

-- ============================================================================
-- 1. VER COLABORADORAS E VENDEDORES PARA MAPEAR
-- ============================================================================

-- Ver colaboradoras ativas da loja "Sacada | Oh, Boy"
SELECT 
    p.id,
    p.name as colaboradora,
    p.cpf,
    p.email,
    p.tiny_vendedor_id as id_tiny_atual,
    s.name as loja
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND s.name ILIKE '%sacada%'
ORDER BY p.name;

-- Ver vendedores únicos do Tiny (últimos 90 dias)
SELECT DISTINCT
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    s.name as loja,
    COUNT(*) as total_pedidos,
    MAX(ped.created_at) as ultimo_pedido
FROM sistemaretiradas.tiny_orders ped
JOIN sistemaretiradas.stores s ON ped.store_id = s.id
WHERE ped.vendedor_nome IS NOT NULL
  AND s.name ILIKE '%sacada%'
  AND ped.created_at >= NOW() - INTERVAL '90 days'
GROUP BY ped.vendedor_nome, ped.vendedor_tiny_id, s.name
ORDER BY total_pedidos DESC;

-- ============================================================================
-- 2. MAPEAR MANUALMENTE (Ajuste os valores conforme necessário)
-- ============================================================================

-- Exemplo: Mapear Karol
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '908189863'
WHERE name ILIKE '%karol%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1)
RETURNING id, name, tiny_vendedor_id;

-- Exemplo: Mapear Emilly Souza
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '942469081'
WHERE name ILIKE '%emilly%' AND name ILIKE '%souza%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1)
RETURNING id, name, tiny_vendedor_id;

-- Exemplo: Mapear Yasmim Bruna (nome completo)
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '927712006'
WHERE name ILIKE '%yasmim%' AND name ILIKE '%bruna%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1)
RETURNING id, name, tiny_vendedor_id;

-- Exemplo: Mapear Lainy
UPDATE sistemaretiradas.profiles
SET tiny_vendedor_id = '944659469'
WHERE name ILIKE '%lainy%'
  AND role = 'COLABORADORA'
  AND store_id = (SELECT id FROM sistemaretiradas.stores WHERE name ILIKE '%sacada%' LIMIT 1)
RETURNING id, name, tiny_vendedor_id;

-- ============================================================================
-- 3. VERIFICAR MAPEAMENTO APÓS ATUALIZAR
-- ============================================================================

SELECT 
    p.name as colaboradora,
    p.tiny_vendedor_id,
    ped.vendedor_nome as vendedor_tiny,
    ped.vendedor_tiny_id,
    CASE 
        WHEN p.tiny_vendedor_id = ped.vendedor_tiny_id::TEXT THEN '✅ MAPEADO'
        ELSE '❌ SEM MAPEAMENTO'
    END as status
FROM sistemaretiradas.profiles p
CROSS JOIN (
    SELECT DISTINCT vendedor_nome, vendedor_tiny_id
    FROM sistemaretiradas.tiny_orders
    WHERE vendedor_nome IS NOT NULL
    LIMIT 10
) ped
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND (p.name ILIKE '%' || ped.vendedor_nome || '%' OR ped.vendedor_nome ILIKE '%' || p.name || '%')
ORDER BY p.name;

-- ============================================================================
-- 4. VER COLABORADORAS MAPEADAS
-- ============================================================================

SELECT 
    p.name as colaboradora,
    p.tiny_vendedor_id,
    s.name as loja,
    CASE 
        WHEN p.tiny_vendedor_id IS NOT NULL THEN '✅ MAPEADA'
        ELSE '❌ SEM ID DO TINY'
    END as status
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
ORDER BY s.name, p.name;

