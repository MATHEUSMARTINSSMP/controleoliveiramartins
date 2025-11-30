-- ============================================================================
-- SCRIPT: Corrigir IDs Duplicados do Tiny e Identificar Problemas
-- Descrição: Identifica colaboradoras com mesmo tiny_vendedor_id e ajuda a corrigir
-- ============================================================================

-- ============================================================================
-- 1. IDENTIFICAR COLABORADORAS COM MESMO tiny_vendedor_id (PROBLEMA!)
-- ============================================================================

SELECT 
    p.tiny_vendedor_id,
    COUNT(*) as total_colaboradoras,
    STRING_AGG(p.name, ', ' ORDER BY p.name) as colaboradoras,
    STRING_AGG(p.id::TEXT, ', ') as ids_colaboradoras,
    s.name as loja
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.tiny_vendedor_id IS NOT NULL
GROUP BY p.tiny_vendedor_id, s.name
HAVING COUNT(*) > 1
ORDER BY total_colaboradoras DESC;

-- ============================================================================
-- 2. VER DETALHES DAS COLABORADORAS DUPLICADAS
-- ============================================================================

SELECT 
    p.id,
    p.name as colaboradora,
    p.cpf,
    p.email,
    p.tiny_vendedor_id,
    s.name as loja,
    -- Ver quantos pedidos cada uma tem
    (SELECT COUNT(*) 
     FROM sistemaretiradas.tiny_orders ped 
     WHERE ped.colaboradora_id = p.id) as total_pedidos_matchados,
    -- Ver vendedor do Tiny correspondente
    (SELECT DISTINCT vendedor_nome 
     FROM sistemaretiradas.tiny_orders 
     WHERE vendedor_tiny_id::TEXT = p.tiny_vendedor_id 
     LIMIT 1) as vendedor_tiny_nome
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.tiny_vendedor_id IN (
      -- IDs que estão duplicados
      SELECT tiny_vendedor_id
      FROM sistemaretiradas.profiles
      WHERE role = 'COLABORADORA'
        AND active = true
        AND tiny_vendedor_id IS NOT NULL
      GROUP BY tiny_vendedor_id
      HAVING COUNT(*) > 1
  )
ORDER BY p.tiny_vendedor_id, p.name;

-- ============================================================================
-- 3. VER QUAL COLABORADORA DEVE MANTER O ID (baseado em pedidos matchados)
-- ============================================================================

-- Para cada ID duplicado, mostrar qual colaboradora tem mais pedidos matchados
WITH colaboradoras_duplicadas AS (
    SELECT 
        p.id,
        p.name,
        p.tiny_vendedor_id,
        p.store_id,
        (SELECT COUNT(*) 
         FROM sistemaretiradas.tiny_orders ped 
         WHERE ped.colaboradora_id = p.id) as total_pedidos
    FROM sistemaretiradas.profiles p
    WHERE p.role = 'COLABORADORA'
      AND p.active = true
      AND p.tiny_vendedor_id IN (
          SELECT tiny_vendedor_id
          FROM sistemaretiradas.profiles
          WHERE role = 'COLABORADORA'
            AND active = true
            AND tiny_vendedor_id IS NOT NULL
          GROUP BY tiny_vendedor_id
          HAVING COUNT(*) > 1
      )
)
SELECT 
    tiny_vendedor_id,
    name as colaboradora_manter_id,
    total_pedidos,
    id as colaboradora_id,
    -- Outras colaboradoras com mesmo ID
    (SELECT STRING_AGG(name || ' (ID: ' || id::TEXT || ')', ', ')
     FROM colaboradoras_duplicadas cd2
     WHERE cd2.tiny_vendedor_id = cd1.tiny_vendedor_id
       AND cd2.id != cd1.id) as outras_colaboradoras
FROM colaboradoras_duplicadas cd1
WHERE total_pedidos = (
    SELECT MAX(total_pedidos)
    FROM colaboradoras_duplicadas cd2
    WHERE cd2.tiny_vendedor_id = cd1.tiny_vendedor_id
)
ORDER BY tiny_vendedor_id;

-- ============================================================================
-- 4. GERAR COMANDOS PARA REMOVER ID DUPLICADO DAS OUTRAS COLABORADORAS
-- ============================================================================

-- Gerar UPDATE para limpar ID das colaboradoras que não devem ter
WITH colaboradoras_duplicadas AS (
    SELECT 
        p.id,
        p.name,
        p.tiny_vendedor_id,
        (SELECT COUNT(*) 
         FROM sistemaretiradas.tiny_orders ped 
         WHERE ped.colaboradora_id = p.id) as total_pedidos
    FROM sistemaretiradas.profiles p
    WHERE p.role = 'COLABORADORA'
      AND p.active = true
      AND p.tiny_vendedor_id IN (
          SELECT tiny_vendedor_id
          FROM sistemaretiradas.profiles
          WHERE role = 'COLABORADORA'
            AND active = true
            AND tiny_vendedor_id IS NOT NULL
          GROUP BY tiny_vendedor_id
          HAVING COUNT(*) > 1
      )
),
colaboradoras_manter AS (
    SELECT 
        tiny_vendedor_id,
        MAX(total_pedidos) as max_pedidos
    FROM colaboradoras_duplicadas
    GROUP BY tiny_vendedor_id
)
SELECT 
    'UPDATE sistemaretiradas.profiles SET tiny_vendedor_id = NULL WHERE id = ''' || cd.id || '''; -- Remover ID de ' || cd.name || ' (ID Tiny: ' || cd.tiny_vendedor_id || ', Pedidos: ' || cd.total_pedidos || ')' as comando_update
FROM colaboradoras_duplicadas cd
JOIN colaboradoras_manter cm ON cd.tiny_vendedor_id = cm.tiny_vendedor_id
WHERE cd.total_pedidos < cm.max_pedidos
ORDER BY cd.tiny_vendedor_id, cd.total_pedidos DESC;

-- ============================================================================
-- 5. VER TODAS AS COLABORADORAS SEM ID DO TINY (para mapear depois)
-- ============================================================================

SELECT 
    p.name as colaboradora,
    p.cpf,
    p.email,
    s.name as loja,
    (SELECT COUNT(*) 
     FROM sistemaretiradas.tiny_orders ped 
     WHERE ped.colaboradora_id = p.id) as total_pedidos_matchados,
    -- Sugerir vendedores do Tiny com nome similar
    (SELECT STRING_AGG(DISTINCT vendedor_nome || ' (ID: ' || vendedor_tiny_id::TEXT || ')', ', ')
     FROM sistemaretiradas.tiny_orders ped
     WHERE ped.store_id = p.store_id
       AND ped.vendedor_nome IS NOT NULL
       AND (
           LOWER(REGEXP_REPLACE(p.name, '[^a-z ]', '', 'g')) LIKE 
           '%' || LOWER(REGEXP_REPLACE(ped.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
           OR
           LOWER(REGEXP_REPLACE(ped.vendedor_nome, '[^a-z ]', '', 'g')) LIKE 
           '%' || LOWER(REGEXP_REPLACE(p.name, '[^a-z ]', '', 'g')) || '%'
       )
     LIMIT 5) as vendedores_similares
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.tiny_vendedor_id IS NULL
ORDER BY s.name, p.name;

