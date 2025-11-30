-- ============================================================================
-- SCRIPT: Verificar CPF de Colaboradoras e Vendedores
-- Descrição: Queries para diagnosticar por que CPF não está funcionando
-- ============================================================================

-- ============================================================================
-- 1. VER COLABORADORAS E SEUS CPFs
-- ============================================================================

SELECT 
    p.id,
    p.name as colaboradora,
    p.cpf,
    p.email,
    s.name as loja,
    CASE 
        WHEN p.cpf IS NULL OR p.cpf = '' THEN '❌ SEM CPF'
        WHEN LENGTH(REGEXP_REPLACE(p.cpf, '\D', '', 'g')) < 11 THEN '⚠️ CPF INVÁLIDO'
        ELSE '✅ TEM CPF'
    END as status_cpf
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
ORDER BY s.name, p.name;

-- ============================================================================
-- 2. VENDEDORES DO TINY E SEUS IDs
-- ============================================================================

SELECT DISTINCT
    ped.vendedor_nome,
    ped.vendedor_tiny_id,
    s.name as loja,
    COUNT(*) as total_pedidos,
    MIN(ped.created_at) as primeiro_pedido,
    MAX(ped.created_at) as ultimo_pedido
FROM sistemaretiradas.tiny_orders ped
JOIN sistemaretiradas.stores s ON ped.store_id = s.id
WHERE ped.vendedor_nome IS NOT NULL
GROUP BY ped.vendedor_nome, ped.vendedor_tiny_id, s.name
ORDER BY loja, total_pedidos DESC;

-- ============================================================================
-- 3. COLABORADORAS QUE DEVEM TER MATCH MAS NÃO TÊM (POR NOME)
-- ============================================================================

-- Colaboradoras ativas da loja
WITH colaboradoras_ativas AS (
    SELECT 
        p.id,
        p.name,
        p.cpf,
        p.email,
        p.store_id,
        s.name as loja
    FROM sistemaretiradas.profiles p
    JOIN sistemaretiradas.stores s ON p.store_id = s.id
    WHERE p.role = 'COLABORADORA'
      AND p.active = true
),
-- Vendedores sem match
vendedores_sem_match AS (
    SELECT DISTINCT
        ped.vendedor_nome,
        ped.vendedor_tiny_id,
        ped.store_id,
        s.name as loja
    FROM sistemaretiradas.tiny_orders ped
    JOIN sistemaretiradas.stores s ON ped.store_id = s.id
    WHERE ped.colaboradora_id IS NULL
      AND ped.vendedor_nome IS NOT NULL
)
-- Comparar nomes (normalizados)
SELECT 
    c.name as colaboradora_supabase,
    c.cpf as colaboradora_cpf,
    c.email as colaboradora_email,
    v.vendedor_nome as vendedor_tiny,
    v.vendedor_tiny_id,
    c.loja,
    CASE 
        WHEN LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) = 
             LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) 
        THEN '✅ NOMES SIMILARES - DEVERIA MATCH'
        ELSE '❌ NOMES DIFERENTES'
    END as observacao
FROM colaboradoras_ativas c
JOIN vendedores_sem_match v ON c.store_id = v.store_id
WHERE LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) LIKE 
      '%' || LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) || '%'
   OR LOWER(REGEXP_REPLACE(v.vendedor_nome, '[^a-z ]', '', 'g')) LIKE 
      '%' || LOWER(REGEXP_REPLACE(c.name, '[^a-z ]', '', 'g')) || '%'
ORDER BY c.loja, c.name;

-- ============================================================================
-- 4. VERIFICAR SE HÁ COLABORADORAS COM NOMES SIMILARES AOS VENDEDORES
-- ============================================================================

SELECT 
    'Karol' as vendedor_tiny,
    p.name as colaboradora_supabase,
    p.cpf,
    s.name as loja,
    CASE 
        WHEN p.name ILIKE '%karol%' THEN '✅ MATCH POTENCIAL'
        ELSE '❌ Não similar'
    END as match_potencial
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND (p.name ILIKE '%karol%' OR p.name ILIKE '%carol%')

UNION ALL

SELECT 
    'Emilly Souza' as vendedor_tiny,
    p.name as colaboradora_supabase,
    p.cpf,
    s.name as loja,
    CASE 
        WHEN p.name ILIKE '%emilly%' AND p.name ILIKE '%souza%' THEN '✅ MATCH POTENCIAL'
        ELSE '❌ Não similar'
    END as match_potencial
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.name ILIKE '%emilly%'
  AND p.name ILIKE '%souza%'

UNION ALL

SELECT 
    'Yasmim Bruna' as vendedor_tiny,
    p.name as colaboradora_supabase,
    p.cpf,
    s.name as loja,
    CASE 
        WHEN p.name ILIKE '%yasmim%' AND p.name ILIKE '%bruna%' THEN '✅ MATCH POTENCIAL'
        ELSE '❌ Não similar'
    END as match_potencial
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.name ILIKE '%yasmim%'
  AND p.name ILIKE '%bruna%'

UNION ALL

SELECT 
    'Lainy' as vendedor_tiny,
    p.name as colaboradora_supabase,
    p.cpf,
    s.name as loja,
    CASE 
        WHEN p.name ILIKE '%lainy%' THEN '✅ MATCH POTENCIAL'
        ELSE '❌ Não similar'
    END as match_potencial
FROM sistemaretiradas.profiles p
JOIN sistemaretiradas.stores s ON p.store_id = s.id
WHERE p.role = 'COLABORADORA'
  AND p.active = true
  AND p.name ILIKE '%lainy%';

-- ============================================================================
-- 5. ESTATÍSTICAS DE CPF
-- ============================================================================

SELECT 
    'Colaboradoras com CPF' as tipo,
    COUNT(*) as total
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
  AND active = true
  AND cpf IS NOT NULL
  AND cpf != ''
  AND LENGTH(REGEXP_REPLACE(cpf, '\D', '', 'g')) >= 11

UNION ALL

SELECT 
    'Colaboradoras sem CPF' as tipo,
    COUNT(*) as total
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
  AND active = true
  AND (cpf IS NULL OR cpf = '' OR LENGTH(REGEXP_REPLACE(cpf, '\D', '', 'g')) < 11);

