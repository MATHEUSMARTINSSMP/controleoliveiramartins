-- ============================================================================
-- SCRIPT: Identificar Qual ID do Tiny Corresponde a Qual Colaboradora
-- Descrição: Queries para ajudar a mapear colaboradoras com vendedores do Tiny
-- ============================================================================

-- ============================================================================
-- 1. COMPARAR NOMES: Colaboradoras vs Vendedores do Tiny
-- ============================================================================

-- Mostra colaboradoras e vendedores com nomes similares
WITH colaboradoras AS (
    SELECT 
        p.id,
        p.name as nome_colaboradora,
        p.cpf,
        p.email,
        p.tiny_vendedor_id as id_tiny_atual,
        s.name as loja,
        s.id as store_id
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON p.store_id = s.id
    WHERE p.role = 'COLABORADORA'
      AND p.active = true
),
vendedores_tiny AS (
    SELECT DISTINCT
        ped.vendedor_nome,
        ped.vendedor_tiny_id,
        ped.store_id,
        COUNT(*) as total_pedidos,
        MAX(ped.created_at) as ultimo_pedido
    FROM sistemaretiradas.tiny_orders ped
    WHERE ped.vendedor_nome IS NOT NULL
      AND ped.vendedor_tiny_id IS NOT NULL
    GROUP BY ped.vendedor_nome, ped.vendedor_tiny_id, ped.store_id
)
SELECT 
    c.nome_colaboradora,
    c.cpf as cpf_colaboradora,
    c.email as email_colaboradora,
    c.id_tiny_atual as id_tiny_ja_mapeado,
    v.vendedor_nome as vendedor_tiny,
    v.vendedor_tiny_id as id_tiny_sugerido,
    v.total_pedidos,
    v.ultimo_pedido,
    c.loja,
    CASE 
        -- Nome exato (normalizado)
        WHEN LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) = 
             LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) 
        THEN '✅ MATCH EXATO - Alta Confiança'
        
        -- Nome contém o outro
        WHEN LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) LIKE 
             '%' || LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
          OR LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) LIKE 
             '%' || LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) || '%'
        THEN '⚠️ MATCH PARCIAL - Verificar Manualmente'
        
        -- Primeiro nome igual
        WHEN SPLIT_PART(LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')), ' ', 1) = 
             SPLIT_PART(LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')), ' ', 1)
        THEN '⚠️ PRIMEIRO NOME IGUAL - Verificar'
        
        ELSE '❌ NOMES DIFERENTES'
    END as confianca_match
FROM colaboradoras c
CROSS JOIN vendedores_tiny v
WHERE c.store_id = v.store_id
  AND (
      -- Match exato
      LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) = 
      LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g'))
      
      -- Ou match parcial
      OR LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) LIKE 
         '%' || LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
      OR LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) LIKE 
         '%' || LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')) || '%'
      
      -- Ou primeiro nome igual
      OR SPLIT_PART(LOWER(REGEXP_REPLACE(c.nome_colaboradora, '[^a-z ]', '', 'g')), ' ', 1) = 
         SPLIT_PART(LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')), ' ', 1)
  )
ORDER BY 
    CASE confianca_match
        WHEN '✅ MATCH EXATO - Alta Confiança' THEN 1
        WHEN '⚠️ MATCH PARCIAL - Verificar Manualmente' THEN 2
        WHEN '⚠️ PRIMEIRO NOME IGUAL - Verificar' THEN 3
        ELSE 4
    END,
    v.total_pedidos DESC;

-- ============================================================================
-- 2. VER PEDIDOS QUE JÁ TIVERAM MATCH POR NOME (Histórico)
-- ============================================================================

-- Se algum pedido já teve match por nome, podemos usar o ID do vendedor desse pedido
SELECT DISTINCT
    p.name as colaboradora,
    ped.vendedor_nome as vendedor_tiny,
    ped.vendedor_tiny_id as id_tiny_sugerido,
    COUNT(*) as total_pedidos_com_match,
    MAX(ped.created_at) as ultimo_pedido,
    s.name as loja
FROM sistemaretiradas.tiny_orders ped
JOIN sistemaretiradas.profiles p ON ped.colaboradora_id = p.id
JOIN sistemaretiradas.stores s ON ped.store_id = s.id
WHERE ped.colaboradora_id IS NOT NULL
  AND ped.vendedor_tiny_id IS NOT NULL
GROUP BY p.id, p.name, ped.vendedor_nome, ped.vendedor_tiny_id, s.name
ORDER BY total_pedidos_com_match DESC, ultimo_pedido DESC;

-- ============================================================================
-- 3. VER TODAS AS COLABORADORAS E SEUS POSSÍVEIS MATCHES
-- ============================================================================

-- Lista todas as colaboradoras e sugere matches baseado em nomes
SELECT 
    c.id as colaboradora_id,
    c.name as colaboradora,
    c.cpf,
    c.email,
    c.tiny_vendedor_id as id_tiny_atual,
    STRING_AGG(
        DISTINCT v.vendedor_nome || ' (ID: ' || v.vendedor_tiny_id || ')',
        ', '
        ORDER BY v.vendedor_nome || ' (ID: ' || v.vendedor_tiny_id || ')'
    ) as vendedores_similares,
    s.name as loja
FROM sistemaretiradas.profiles c
JOIN sistemaretiradas.stores s ON c.store_id = s.id
LEFT JOIN sistemaretiradas.tiny_orders ped ON c.store_id = ped.store_id
LEFT JOIN LATERAL (
    SELECT DISTINCT 
        ped2.vendedor_nome,
        ped2.vendedor_tiny_id
    FROM sistemaretiradas.tiny_orders ped2
    WHERE ped2.store_id = c.store_id
      AND ped2.vendedor_nome IS NOT NULL
      AND (
          -- Match exato
          LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) = 
          LOWER(REGEXP_REPLACE(ped2.vendedor_nome, '[^a-z ]', '', 'g'))
          
          -- Ou match parcial
          OR LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) LIKE 
             '%' || LOWER(REGEXP_REPLACE(ped2.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
          OR LOWER(REGEXP_REPLACE(ped2.vendedor_nome, '[^a-z ]', '', 'g')) LIKE 
             '%' || LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) || '%'
      )
) v ON true
WHERE c.role = 'COLABORADORA'
  AND c.active = true
GROUP BY c.id, c.name, c.cpf, c.email, c.tiny_vendedor_id, s.name
ORDER BY s.name, c.name;

-- ============================================================================
-- 4. QUERY SIMPLIFICADA: Ver Colaboradoras e Vendedores Lado a Lado
-- ============================================================================

-- Versão mais simples para visualização rápida
SELECT 
    'COLABORADORA' as tipo,
    p.name as nome,
    p.cpf,
    p.tiny_vendedor_id as id_tiny,
    s.name as loja
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true

UNION ALL

SELECT 
    'VENDEDOR TINY' as tipo,
    ped.vendedor_nome as nome,
    NULL as cpf,
    ped.vendedor_tiny_id::TEXT as id_tiny,
    s.name as loja
FROM (
    SELECT DISTINCT
        vendedor_nome,
        vendedor_tiny_id,
        store_id
    FROM sistemaretiradas.tiny_orders
    WHERE vendedor_nome IS NOT NULL
      AND vendedor_tiny_id IS NOT NULL
) ped
JOIN sistemaretiradas.stores s ON ped.store_id = s.id

ORDER BY loja, tipo, nome;

-- ============================================================================
-- 5. GERAR SCRIPT DE UPDATE AUTOMÁTICO (Baseado em Match Exato)
-- ============================================================================

-- Gera comandos UPDATE para matches com alta confiança
SELECT 
    'UPDATE sistemaretiradas.profiles SET tiny_vendedor_id = ''' || v.vendedor_tiny_id || ''' WHERE id = ''' || c.id || '''; -- ' || c.name || ' -> ' || v.vendedor_nome as comando_update
FROM sistemaretiradas.profiles c
JOIN sistemaretiradas.stores s ON c.store_id = s.id
CROSS JOIN LATERAL (
    SELECT DISTINCT
        ped.vendedor_nome,
        ped.vendedor_tiny_id
    FROM sistemaretiradas.tiny_orders ped
    WHERE ped.store_id = c.store_id
      AND ped.vendedor_nome IS NOT NULL
      AND ped.vendedor_tiny_id IS NOT NULL
      -- Match exato (normalizado)
      AND LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) = 
          LOWER(REGEXP_REPLACE(ped.vendedor_nome, '[^a-z ]', '', 'g'))
    LIMIT 1
) v
WHERE c.role = 'COLABORADORA'
  AND c.active = true
  AND (c.tiny_vendedor_id IS NULL OR c.tiny_vendedor_id != v.vendedor_tiny_id::TEXT);

