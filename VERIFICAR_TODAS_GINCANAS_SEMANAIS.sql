-- Verificar TODAS as gincanas semanais de TODAS as lojas
-- Independente do store_id

-- 1. Resumo geral: Todas as semanas de todas as lojas
SELECT 
    g.semana_referencia,
    s.name as loja_nome,
    g.store_id,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta,
    SUM(g.super_meta_valor) as total_super_meta,
    MIN(g.created_at) as primeira_criacao,
    MAX(g.created_at) as ultima_criacao
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
GROUP BY g.semana_referencia, s.name, g.store_id
ORDER BY g.semana_referencia DESC, s.name;

-- 2. Detalhado: Todas as metas semanais com informações completas
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
ORDER BY g.semana_referencia DESC, s.name, g.created_at DESC;

-- 3. Estatísticas por loja
SELECT 
    s.name as loja_nome,
    g.store_id,
    COUNT(DISTINCT g.semana_referencia) as total_semanas,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras_unicas,
    SUM(g.meta_valor) as soma_total_meta,
    SUM(g.super_meta_valor) as soma_total_super_meta,
    MIN(g.created_at) as primeira_gincana,
    MAX(g.created_at) as ultima_gincana
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
GROUP BY s.name, g.store_id
ORDER BY s.name;

-- 4. Estatísticas por semana (todas as lojas juntas)
SELECT 
    g.semana_referencia,
    COUNT(DISTINCT g.store_id) as total_lojas,
    COUNT(*) as total_metas,
    COUNT(DISTINCT g.colaboradora_id) as total_colaboradoras,
    SUM(g.meta_valor) as total_meta_geral,
    SUM(g.super_meta_valor) as total_super_meta_geral,
    MIN(g.created_at) as primeira_criacao,
    MAX(g.created_at) as ultima_criacao
FROM sistemaretiradas.goals g
WHERE g.tipo = 'SEMANAL'
GROUP BY g.semana_referencia
ORDER BY g.semana_referencia DESC;

-- 5. Verificar semanas faltantes por loja (comparar com semanas existentes)
-- Esta query mostra quais lojas têm gincanas e quantas semanas cada uma tem
SELECT 
    s.name as loja_nome,
    g.store_id,
    COUNT(DISTINCT g.semana_referencia) as semanas_com_gincana,
    STRING_AGG(DISTINCT g.semana_referencia, ', ' ORDER BY g.semana_referencia DESC) as semanas_lista
FROM sistemaretiradas.goals g
LEFT JOIN sistemaretiradas.stores s ON s.id = g.store_id
WHERE g.tipo = 'SEMANAL'
GROUP BY s.name, g.store_id
ORDER BY s.name;

