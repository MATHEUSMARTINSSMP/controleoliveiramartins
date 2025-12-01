-- Verificar semanas faltantes por loja
-- Comparar quais semanas cada loja tem vs quais deveriam ter

-- 1. Verificar especificamente se Loungerie tem semana 48 (482025)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NÃO EXISTE - Semana 48 (482025) faltando para Loungerie'
        ELSE '✅ EXISTE'
    END as status,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta,
    SUM(g.super_meta_valor) as total_super_meta
FROM sistemaretiradas.goals g
WHERE g.tipo = 'SEMANAL'
    AND g.semana_referencia = '482025'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b';

-- 2. Comparar semanas entre lojas (mostrar quais lojas têm cada semana)
SELECT 
    g.semana_referencia,
    COUNT(DISTINCT g.store_id) as total_lojas_com_gincana,
    STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) as lojas_com_gincana,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
GROUP BY g.semana_referencia
ORDER BY g.semana_referencia DESC;

-- 3. Identificar semanas faltantes por loja
-- Mostra quais semanas cada loja tem e quais outras lojas têm mas ela não tem
WITH todas_semanas AS (
    SELECT DISTINCT semana_referencia 
    FROM sistemaretiradas.goals 
    WHERE tipo = 'SEMANAL'
),
semanas_por_loja AS (
    SELECT 
        g.store_id,
        s.name as loja_nome,
        g.semana_referencia
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'SEMANAL'
    GROUP BY g.store_id, s.name, g.semana_referencia
),
lojas_ativas AS (
    SELECT DISTINCT id as store_id, name as loja_nome
    FROM sistemaretiradas.stores
    WHERE active = true
)
SELECT 
    la.loja_nome,
    la.store_id,
    ts.semana_referencia,
    CASE 
        WHEN spl.semana_referencia IS NOT NULL THEN '✅ TEM'
        ELSE '❌ FALTA'
    END as status
FROM lojas_ativas la
CROSS JOIN todas_semanas ts
LEFT JOIN semanas_por_loja spl ON spl.store_id = la.store_id AND spl.semana_referencia = ts.semana_referencia
ORDER BY ts.semana_referencia DESC, la.loja_nome;

-- 4. Resumo: Semanas faltantes por loja (apenas as que faltam)
WITH todas_semanas AS (
    SELECT DISTINCT semana_referencia 
    FROM sistemaretiradas.goals 
    WHERE tipo = 'SEMANAL'
),
semanas_por_loja AS (
    SELECT 
        g.store_id,
        s.name as loja_nome,
        g.semana_referencia
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'SEMANAL'
    GROUP BY g.store_id, s.name, g.semana_referencia
),
lojas_ativas AS (
    SELECT DISTINCT id as store_id, name as loja_nome
    FROM sistemaretiradas.stores
    WHERE active = true
)
SELECT 
    la.loja_nome,
    la.store_id,
    ts.semana_referencia,
    '❌ FALTA' as status
FROM lojas_ativas la
CROSS JOIN todas_semanas ts
LEFT JOIN semanas_por_loja spl ON spl.store_id = la.store_id AND spl.semana_referencia = ts.semana_referencia
WHERE spl.semana_referencia IS NULL
ORDER BY ts.semana_referencia DESC, la.loja_nome;

