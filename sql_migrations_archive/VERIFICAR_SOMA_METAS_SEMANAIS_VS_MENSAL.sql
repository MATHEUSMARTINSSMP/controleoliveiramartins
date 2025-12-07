-- Verificar se a soma das metas semanais bate com a meta mensal
-- Este script ajuda a identificar discrepâncias entre metas semanais e mensais

-- 1. Verificar soma de metas semanais vs meta mensal por loja e mês
WITH metas_semanais AS (
    SELECT 
        g.store_id,
        s.name as loja_nome,
        g.semana_referencia,
        -- Extrair mês da semana (pegar o mês do primeiro dia da semana)
        CASE 
            WHEN SUBSTRING(g.semana_referencia, 1, 2)::int > 50 THEN
                -- Formato antigo YYYYWW
                SUBSTRING(g.semana_referencia, 1, 4) || SUBSTRING(g.semana_referencia, 5, 2)
            ELSE
                -- Formato novo WWYYYY - precisamos calcular o mês da semana
                -- Para simplificar, vamos usar o mês da primeira semana do mês
                -- Isso é uma aproximação, pois semanas podem cruzar meses
                SUBSTRING(g.semana_referencia, 3, 4) || '12' -- Assumindo dezembro por enquanto
        END as mes_aproximado,
        SUM(g.meta_valor) as total_meta_semanal,
        SUM(g.super_meta_valor) as total_super_meta_semanal,
        COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'SEMANAL'
        AND g.store_id IS NOT NULL
    GROUP BY g.store_id, s.name, g.semana_referencia
),
metas_mensais AS (
    SELECT 
        g.store_id,
        s.name as loja_nome,
        g.mes_referencia,
        g.meta_valor as meta_mensal,
        g.super_meta_valor as super_meta_mensal,
        g.daily_weights
    FROM sistemaretiradas.goals g
    LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
    WHERE g.tipo = 'MENSAL'
        AND g.colaboradora_id IS NULL
        AND g.store_id IS NOT NULL
)
SELECT 
    ms.loja_nome,
    ms.store_id,
    ms.mes_aproximado,
    COUNT(DISTINCT ms.semana_referencia) as total_semanas,
    SUM(ms.total_meta_semanal) as soma_metas_semanais,
    SUM(ms.total_super_meta_semanal) as soma_super_metas_semanais,
    mm.meta_mensal,
    mm.super_meta_mensal,
    CASE 
        WHEN mm.meta_mensal IS NOT NULL THEN
            ROUND(((SUM(ms.total_meta_semanal) / mm.meta_mensal) * 100)::numeric, 2)
        ELSE NULL
    END as percentual_meta,
    CASE 
        WHEN mm.super_meta_mensal IS NOT NULL THEN
            ROUND(((SUM(ms.total_super_meta_semanal) / mm.super_meta_mensal) * 100)::numeric, 2)
        ELSE NULL
    END as percentual_super_meta,
    CASE 
        WHEN mm.meta_mensal IS NOT NULL AND ABS(SUM(ms.total_meta_semanal) - mm.meta_mensal) < 0.01 THEN '✅ BATE'
        WHEN mm.meta_mensal IS NOT NULL THEN '❌ NÃO BATE'
        ELSE '⚠️ SEM META MENSAL'
    END as status_meta,
    CASE 
        WHEN mm.super_meta_mensal IS NOT NULL AND ABS(SUM(ms.total_super_meta_semanal) - mm.super_meta_mensal) < 0.01 THEN '✅ BATE'
        WHEN mm.super_meta_mensal IS NOT NULL THEN '❌ NÃO BATE'
        ELSE '⚠️ SEM SUPER META MENSAL'
    END as status_super_meta
FROM metas_semanais ms
LEFT JOIN metas_mensais mm ON mm.store_id = ms.store_id 
    AND mm.mes_referencia = ms.mes_aproximado
GROUP BY ms.loja_nome, ms.store_id, ms.mes_aproximado, mm.meta_mensal, mm.super_meta_mensal
ORDER BY ms.loja_nome, ms.mes_aproximado DESC;

-- 2. Verificar se daily_weights somam 100% para cada meta mensal
SELECT 
    s.name as loja_nome,
    g.store_id,
    g.mes_referencia,
    g.meta_valor,
    g.super_meta_valor,
    g.daily_weights,
    CASE 
        WHEN g.daily_weights IS NULL THEN '❌ SEM DAILY_WEIGHTS'
        WHEN jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            CASE 
                WHEN (
                    SELECT SUM(value::numeric) 
                    FROM jsonb_each_text(g.daily_weights::jsonb)
                ) BETWEEN 99.9 AND 100.1 THEN '✅ SOMA 100%'
                ELSE '❌ NÃO SOMA 100%'
            END
        ELSE '⚠️ FORMATO INVÁLIDO'
    END as status_daily_weights,
    CASE 
        WHEN g.daily_weights IS NOT NULL AND jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            (
                SELECT ROUND(SUM(value::numeric)::numeric, 2)
                FROM jsonb_each_text(g.daily_weights::jsonb)
            )
        ELSE NULL
    END as soma_daily_weights
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'MENSAL'
    AND g.colaboradora_id IS NULL
    AND g.store_id IS NOT NULL
ORDER BY s.name, g.mes_referencia DESC;

-- 3. Verificar semanas que cruzam meses (podem causar discrepâncias)
-- Esta query mostra semanas que começam em um mês e terminam em outro
SELECT 
    g.semana_referencia,
    s.name as loja_nome,
    g.store_id,
    -- Tentar calcular início e fim da semana
    CASE 
        WHEN SUBSTRING(g.semana_referencia, 1, 2)::int > 50 THEN
            -- Formato antigo YYYYWW
            TO_DATE(SUBSTRING(g.semana_referencia, 1, 4) || '-01-01', 'YYYY-MM-DD') + 
            (SUBSTRING(g.semana_referencia, 5, 2)::int - 1) * INTERVAL '7 days'
        ELSE
            -- Formato novo WWYYYY
            TO_DATE(SUBSTRING(g.semana_referencia, 3, 4) || '-01-01', 'YYYY-MM-DD') + 
            (SUBSTRING(g.semana_referencia, 1, 2)::int - 1) * INTERVAL '7 days'
    END as inicio_semana_estimado,
    SUM(g.meta_valor) as total_meta_semanal,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id IS NOT NULL
GROUP BY g.semana_referencia, s.name, g.store_id
ORDER BY g.semana_referencia DESC, s.name;

-- 4. Comparação detalhada: Meta mensal vs soma das semanas do mesmo mês
-- Para dezembro de 2025 (202512)
SELECT 
    'Meta Mensal' as tipo,
    s.name as loja_nome,
    g.store_id,
    g.meta_valor as valor,
    NULL::text as semana_referencia
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'MENSAL'
    AND g.mes_referencia = '202512'
    AND g.colaboradora_id IS NULL
    AND g.store_id IS NOT NULL

UNION ALL

SELECT 
    'Meta Semanal' as tipo,
    s.name as loja_nome,
    g.store_id,
    SUM(g.meta_valor) as valor,
    g.semana_referencia
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.semana_referencia LIKE '%2025' -- Semanas de 2025
    AND g.store_id IS NOT NULL
GROUP BY s.name, g.store_id, g.semana_referencia

ORDER BY loja_nome, tipo, semana_referencia;

