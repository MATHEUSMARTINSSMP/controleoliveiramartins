-- Verificar causa da discrepância entre soma das metas semanais e meta mensal
-- Meta mensal: 95.000
-- Soma das semanas de dezembro: 88.350
-- Diferença: 6.650 (7% de diferença)

-- 1. Verificar se daily_weights soma 100% para dezembro
SELECT 
    s.name as loja_nome,
    g.mes_referencia,
    g.meta_valor,
    g.super_meta_valor,
    g.daily_weights,
    -- Verificar soma dos daily_weights
    CASE 
        WHEN g.daily_weights IS NOT NULL AND jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            (
                SELECT ROUND(SUM(value::numeric)::numeric, 2)
                FROM jsonb_each_text(g.daily_weights::jsonb)
            )
        ELSE NULL
    END as soma_daily_weights,
    -- Contar quantos dias têm peso
    CASE 
        WHEN g.daily_weights IS NOT NULL AND jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            (
                SELECT COUNT(*)
                FROM jsonb_each_text(g.daily_weights::jsonb)
                WHERE value::numeric > 0
            )
        ELSE NULL
    END as dias_com_peso,
    -- Contar total de dias no daily_weights
    CASE 
        WHEN g.daily_weights IS NOT NULL AND jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            (
                SELECT COUNT(*)
                FROM jsonb_each_text(g.daily_weights::jsonb)
            )
        ELSE NULL
    END as total_dias_daily_weights,
    CASE 
        WHEN g.daily_weights IS NOT NULL AND jsonb_typeof(g.daily_weights::jsonb) = 'object' THEN
            CASE 
                WHEN (
                    SELECT SUM(value::numeric) 
                    FROM jsonb_each_text(g.daily_weights::jsonb)
                ) BETWEEN 99.9 AND 100.1 THEN '✅ SOMA 100%'
                ELSE '❌ NÃO SOMA 100%'
            END
        ELSE '⚠️ SEM DAILY_WEIGHTS'
    END as status_daily_weights
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'MENSAL'
    AND g.mes_referencia = '202512'
    AND g.colaboradora_id IS NULL
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b';

-- 2. Verificar se a semana 48 pertence a dezembro (pode começar em dezembro)
-- Semana 48 de 2025: aproximadamente 25/11 a 01/12
-- Se começar em 25/11, é novembro. Se começar em 01/12, é dezembro.
SELECT 
    'Semana 48' as semana,
    g.semana_referencia,
    s.name as loja_nome,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta_semanal,
    CASE 
        WHEN SUM(g.meta_valor) > 0 THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia = '482025'
GROUP BY g.semana_referencia, s.name;

-- 3. Calcular o que deveria ser a soma baseado nos daily_weights
-- Vamos simular o cálculo para cada semana de dezembro
WITH semanas_dezembro AS (
    SELECT DISTINCT g.semana_referencia
    FROM sistemaretiradas.goals g
    WHERE g.tipo = 'SEMANAL'
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
        AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
),
meta_mensal AS (
    SELECT 
        g.meta_valor,
        g.daily_weights
    FROM sistemaretiradas.goals g
    WHERE g.tipo = 'MENSAL'
        AND g.mes_referencia = '202512'
        AND g.colaboradora_id IS NULL
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
)
SELECT 
    'Análise' as tipo,
    'Meta mensal' as descricao,
    mm.meta_valor as valor,
    NULL::text as semana_referencia
FROM meta_mensal mm

UNION ALL

SELECT 
    'Análise' as tipo,
    'Soma atual das semanas' as descricao,
    SUM(g.meta_valor) as valor,
    NULL::text as semana_referencia
FROM sistemaretiradas.goals g
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
    AND g.semana_referencia IN ('492025', '502025', '512025', '522025')

UNION ALL

SELECT 
    'Análise' as tipo,
    'Diferença' as descricao,
    mm.meta_valor - (
        SELECT SUM(g.meta_valor)
        FROM sistemaretiradas.goals g
        WHERE g.tipo = 'SEMANAL'
            AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
            AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
    ) as valor,
    NULL::text as semana_referencia
FROM meta_mensal mm;

-- 4. Verificar se há dias de dezembro sem peso nos daily_weights
-- Isso pode indicar que alguns dias não estão sendo contabilizados
WITH meta_mensal AS (
    SELECT 
        g.daily_weights
    FROM sistemaretiradas.goals g
    WHERE g.tipo = 'MENSAL'
        AND g.mes_referencia = '202512'
        AND g.colaboradora_id IS NULL
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
),
dias_dezembro AS (
    SELECT 
        generate_series(
            '2025-12-01'::date,
            '2025-12-31'::date,
            '1 day'::interval
        )::date as dia
)
SELECT 
    dd.dia,
    to_char(dd.dia, 'yyyy-MM-dd') as dia_str,
    CASE 
        WHEN mm.daily_weights IS NOT NULL AND jsonb_typeof(mm.daily_weights::jsonb) = 'object' THEN
            (mm.daily_weights::jsonb->>to_char(dd.dia, 'yyyy-MM-dd'))::numeric
        ELSE NULL
    END as peso,
    CASE 
        WHEN mm.daily_weights IS NOT NULL AND jsonb_typeof(mm.daily_weights::jsonb) = 'object' THEN
            CASE 
                WHEN (mm.daily_weights::jsonb->>to_char(dd.dia, 'yyyy-MM-dd')) IS NULL THEN '❌ SEM PESO'
                WHEN (mm.daily_weights::jsonb->>to_char(dd.dia, 'yyyy-MM-dd'))::numeric = 0 THEN '⚠️ PESO ZERO'
                ELSE '✅ TEM PESO'
            END
        ELSE '⚠️ SEM DAILY_WEIGHTS'
    END as status
FROM dias_dezembro dd
CROSS JOIN meta_mensal mm
ORDER BY dd.dia;

-- 5. Calcular soma dos pesos apenas dos dias que estão nas semanas de dezembro
-- Semana 49: 01/12 a 07/12
-- Semana 50: 08/12 a 14/12
-- Semana 51: 15/12 a 21/12
-- Semana 52: 22/12 a 28/12
-- (Pode haver dias 29, 30, 31 que não estão em nenhuma semana completa)
WITH meta_mensal AS (
    SELECT 
        g.meta_valor,
        g.daily_weights
    FROM sistemaretiradas.goals g
    WHERE g.tipo = 'MENSAL'
        AND g.mes_referencia = '202512'
        AND g.colaboradora_id IS NULL
        AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
),
dias_semanas_dezembro AS (
    SELECT dia::date
    FROM generate_series('2025-12-01'::date, '2025-12-28'::date, '1 day'::interval) dia
    -- Excluir dias 29, 30, 31 que podem não estar em semanas completas
)
SELECT 
    'Soma dos pesos das semanas 49-52 (01/12 a 28/12)' as descricao,
    CASE 
        WHEN mm.daily_weights IS NOT NULL AND jsonb_typeof(mm.daily_weights::jsonb) = 'object' THEN
            ROUND((
                SELECT SUM((mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd'))::numeric)
                FROM dias_semanas_dezembro
                WHERE mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd') IS NOT NULL
            )::numeric, 2)
        ELSE NULL
    END as soma_pesos_percentual,
    CASE 
        WHEN mm.daily_weights IS NOT NULL AND jsonb_typeof(mm.daily_weights::jsonb) = 'object' THEN
            ROUND((
                (SELECT SUM((mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd'))::numeric)
                FROM dias_semanas_dezembro
                WHERE mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd') IS NOT NULL) * mm.meta_valor / 100
            )::numeric, 2)
        ELSE NULL
    END as meta_esperada_baseada_em_pesos,
    mm.meta_valor as meta_mensal_total,
    (
        SELECT SUM(g.meta_valor)
        FROM sistemaretiradas.goals g
        WHERE g.tipo = 'SEMANAL'
            AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
            AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
    ) as soma_atual_semanas,
    CASE 
        WHEN mm.daily_weights IS NOT NULL AND jsonb_typeof(mm.daily_weights::jsonb) = 'object' THEN
            ROUND((
                (SELECT SUM((mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd'))::numeric)
                FROM dias_semanas_dezembro
                WHERE mm.daily_weights::jsonb->>to_char(dia, 'yyyy-MM-dd') IS NOT NULL) * mm.meta_valor / 100
            )::numeric, 2) - (
                SELECT SUM(g.meta_valor)
                FROM sistemaretiradas.goals g
                WHERE g.tipo = 'SEMANAL'
                    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
                    AND g.semana_referencia IN ('492025', '502025', '512025', '522025')
            )
        ELSE NULL
    END as diferenca
FROM meta_mensal mm;

