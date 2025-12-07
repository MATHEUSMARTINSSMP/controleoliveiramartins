-- ============================================================================
-- Verificar Gincanas Semanais no Banco de Dados
-- ============================================================================

-- 1. Contar total de gincanas semanais
SELECT 
    COUNT(*) as total_gincanas,
    COUNT(DISTINCT store_id) as total_lojas,
    COUNT(DISTINCT semana_referencia) as total_semanas_unicas
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL';

-- 2. Listar todas as gincanas ordenadas por semana_referencia
SELECT 
    id,
    store_id,
    semana_referencia,
    colaboradora_id,
    meta_valor,
    super_meta_valor,
    created_at,
    updated_at,
    (SELECT name FROM sistemaretiradas.stores WHERE id = g.store_id) as loja_nome,
    (SELECT name FROM sistemaretiradas.profiles WHERE id = g.colaboradora_id) as colaboradora_nome
FROM sistemaretiradas.goals g
WHERE tipo = 'SEMANAL'
ORDER BY created_at DESC
LIMIT 50;

-- 3. Verificar formato da semana_referencia (YYYYWW vs WWYYYY)
SELECT 
    semana_referencia,
    LENGTH(semana_referencia) as tamanho,
    SUBSTRING(semana_referencia, 1, 2) as primeiros_2_digitos,
    SUBSTRING(semana_referencia, 1, 4) as primeiros_4_digitos,
    COUNT(*) as quantidade
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL'
GROUP BY semana_referencia
ORDER BY semana_referencia DESC
LIMIT 20;

-- 4. Verificar gincanas por loja
SELECT 
    s.name as loja,
    COUNT(DISTINCT g.semana_referencia) as total_semanas,
    COUNT(*) as total_gincanas,
    MIN(g.created_at) as primeira_gincana,
    MAX(g.created_at) as ultima_gincana
FROM sistemaretiradas.goals g
JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
GROUP BY s.id, s.name
ORDER BY s.name;

-- 5. Verificar gincanas de novembro de 2025 (semana que termina em 30/11)
-- Semana 48 de 2025: 25/11 a 01/12 (formato WWYYYY = 482025)
-- Semana 47 de 2025: 18/11 a 24/11 (formato WWYYYY = 472025)
-- Semana 46 de 2025: 11/11 a 17/11 (formato WWYYYY = 462025)
SELECT 
    semana_referencia,
    COUNT(*) as total_metas,
    COUNT(DISTINCT colaboradora_id) as total_colaboradoras,
    SUM(meta_valor) as total_meta,
    SUM(super_meta_valor) as total_super_meta,
    MIN(created_at) as criada_em
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL'
    AND (
        semana_referencia LIKE '%2025' OR 
        semana_referencia LIKE '2025%' OR
        semana_referencia LIKE '48%' OR
        semana_referencia LIKE '47%' OR
        semana_referencia LIKE '46%'
    )
GROUP BY semana_referencia
ORDER BY semana_referencia DESC;

-- 6. Verificar se há gincanas deletadas ou com problemas
SELECT 
    'Gincanas sem store_id' as problema,
    COUNT(*) as quantidade
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL' AND store_id IS NULL

UNION ALL

SELECT 
    'Gincanas sem colaboradora_id' as problema,
    COUNT(*) as quantidade
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL' AND colaboradora_id IS NULL

UNION ALL

SELECT 
    'Gincanas com semana_referencia NULL' as problema,
    COUNT(*) as quantidade
FROM sistemaretiradas.goals
WHERE tipo = 'SEMANAL' AND semana_referencia IS NULL;

