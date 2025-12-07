-- Verificar soma correta das metas semanais POR MÊS
-- A semana 47 (472025) é de NOVEMBRO, não dezembro!
-- Precisamos verificar apenas as semanas que pertencem ao mesmo mês

-- 1. Função auxiliar para calcular o mês de uma semana (aproximado)
-- Semana 47 = final de novembro
-- Semana 48 = início de dezembro  
-- Semana 49 = dezembro
-- Semana 50 = dezembro
-- Semana 51 = dezembro
-- Semana 52 = final de dezembro / início de janeiro

-- 2. Verificar quais semanas pertencem a dezembro de 2025
-- Baseado no formato WWYYYY, onde WW é a semana ISO
WITH semanas_dezembro AS (
    SELECT 
        g.semana_referencia,
        s.name as loja_nome,
        g.store_id,
        SUM(g.meta_valor) as total_meta_semanal,
        SUM(g.super_meta_valor) as total_super_meta_semanal,
        COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'SEMANAL'
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b' -- Loungerie
        -- Semanas de dezembro 2025: 49, 50, 51, 52 (e possivelmente 48 se começar em dezembro)
        AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
    GROUP BY g.semana_referencia, s.name, g.store_id
),
soma_dezembro AS (
    SELECT 
        store_id,
        loja_nome,
        SUM(total_meta_semanal) as soma_total_meta,
        SUM(total_super_meta_semanal) as soma_total_super_meta,
        COUNT(*) as total_semanas
    FROM semanas_dezembro
    GROUP BY store_id, loja_nome
),
meta_mensal_dezembro AS (
    SELECT 
        g.store_id,
        s.name as loja_nome,
        g.meta_valor,
        g.super_meta_valor
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'MENSAL'
        AND g.mes_referencia = '202512'
        AND g.colaboradora_id IS NULL
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
)
SELECT 
    sd.loja_nome,
    sd.store_id,
    sd.total_semanas,
    sd.soma_total_meta,
    mm.meta_valor as meta_mensal_dezembro,
    sd.soma_total_super_meta,
    mm.super_meta_valor as super_meta_mensal_dezembro,
    CASE 
        WHEN mm.meta_valor IS NOT NULL THEN
            ROUND(((sd.soma_total_meta / mm.meta_valor) * 100)::numeric, 2)
        ELSE NULL
    END as percentual_meta,
    CASE 
        WHEN mm.super_meta_valor IS NOT NULL THEN
            ROUND(((sd.soma_total_super_meta / mm.super_meta_valor) * 100)::numeric, 2)
        ELSE NULL
    END as percentual_super_meta,
    CASE 
        WHEN mm.meta_valor IS NOT NULL AND ABS(sd.soma_total_meta - mm.meta_valor) < 0.01 THEN '✅ BATE'
        WHEN mm.meta_valor IS NOT NULL THEN '❌ NÃO BATE'
        ELSE '⚠️ SEM META MENSAL'
    END as status_meta,
    CASE 
        WHEN mm.super_meta_valor IS NOT NULL AND ABS(sd.soma_total_super_meta - mm.super_meta_valor) < 0.01 THEN '✅ BATE'
        WHEN mm.super_meta_valor IS NOT NULL THEN '❌ NÃO BATE'
        ELSE '⚠️ SEM SUPER META MENSAL'
    END as status_super_meta,
    CASE 
        WHEN mm.meta_valor IS NOT NULL THEN
            sd.soma_total_meta - mm.meta_valor
        ELSE NULL
    END as diferenca_meta,
    CASE 
        WHEN mm.super_meta_valor IS NOT NULL THEN
            sd.soma_total_super_meta - mm.super_meta_valor
        ELSE NULL
    END as diferenca_super_meta
FROM soma_dezembro sd
LEFT JOIN meta_mensal_dezembro mm ON mm.store_id = sd.store_id;

-- 3. Verificar detalhes de cada semana de dezembro
SELECT 
    g.semana_referencia,
    s.name as loja_nome,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta_semanal,
    SUM(g.super_meta_valor) as total_super_meta_semanal,
    -- Calcular qual deveria ser a meta semanal baseado na meta mensal
    (95000.00 / 4.33) as meta_esperada_proporcional_4_33,
    (95000.00 / 5) as meta_esperada_proporcional_5_semanas,
    -- Diferença
    SUM(g.meta_valor) - (95000.00 / 5) as diferenca_vs_proporcional
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
GROUP BY g.semana_referencia, s.name
ORDER BY g.semana_referencia;

-- 4. Verificar se a semana 48 também é de dezembro (pode começar em dezembro)
SELECT 
    g.semana_referencia,
    s.name as loja_nome,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta_semanal
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia = '482025'
GROUP BY g.semana_referencia, s.name;

-- 5. Comparação completa: Novembro vs Dezembro
SELECT 
    'NOVEMBRO 2025' as mes,
    s.name as loja_nome,
    COUNT(DISTINCT g.semana_referencia) as total_semanas,
    SUM(g.meta_valor) as soma_metas_semanais
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia = '472025' -- Apenas semana 47 (novembro)
GROUP BY s.name

UNION ALL

SELECT 
    'DEZEMBRO 2025' as mes,
    s.name as loja_nome,
    COUNT(DISTINCT g.semana_referencia) as total_semanas,
    SUM(g.meta_valor) as soma_metas_semanais
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia IN ('492025', '502025', '512025', '522025') -- Semanas de dezembro
GROUP BY s.name

ORDER BY mes, loja_nome;

