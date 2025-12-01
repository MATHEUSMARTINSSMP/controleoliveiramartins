-- Verificar se existe gincana semanal semana 48 (482025) para a loja Loungerie
-- Semana 48 de 2025: 17/11 - 23/11/2025
-- Store ID: 5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b

-- 1. Verificar se existe gincana semanal semana 48 (482025) para Loungerie
SELECT 
    g.id,
    g.store_id,
    s.name as loja_nome,
    g.semana_referencia,
    g.colaboradora_id,
    p.name as colaboradora_nome,
    g.meta_valor,
    g.super_meta_valor,
    g.ativo,
    g.created_at,
    g.updated_at
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = g.colaboradora_id
WHERE g.tipo = 'SEMANAL'
    AND g.semana_referencia = '482025'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
ORDER BY g.created_at DESC;

-- 2. Resumo: Contar quantas metas semanais existem para semana 48 na Loungerie
SELECT 
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta,
    SUM(g.super_meta_valor) as total_super_meta,
    MIN(g.created_at) as primeira_criacao,
    MAX(g.created_at) as ultima_criacao,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ NÃO EXISTE'
        ELSE '✅ EXISTE'
    END as status
FROM sistemaretiradas.goals g
WHERE g.tipo = 'SEMANAL'
    AND g.semana_referencia = '482025'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b';

-- 3. Verificar todas as semanas da Loungerie (para comparação)
SELECT 
    g.semana_referencia,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta,
    SUM(g.super_meta_valor) as total_super_meta,
    MIN(g.created_at) as primeira_criacao
FROM sistemaretiradas.goals g
WHERE g.tipo = 'SEMANAL'
    AND g.store_id = '5a87e0c2-66ab-4c71-aaae-e3ee85f1cf5b'
GROUP BY g.semana_referencia
ORDER BY g.semana_referencia DESC;

