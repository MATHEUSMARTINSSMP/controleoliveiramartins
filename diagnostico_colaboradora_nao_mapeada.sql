-- ============================================================
-- DIAGNÓSTICO: POR QUE COLABORADORA NÃO FOI MAPEADA?
-- ============================================================
-- Pedido 1449: vendedor_nome = "Yasmim Bruna Mendes Castro"
-- Precisamos verificar:
-- 1. Se existe colaboradora com esse nome no sistema
-- 2. Se ela está vinculada à loja correta
-- 3. Se há diferença de acentos/normalização
-- ============================================================

-- 1. BUSCAR COLABORADORA POR NOME (tentativas com normalização)
WITH colaboradoras_possiveis AS (
    SELECT 
        p.id,
        p.name,
        p.email,
        p.cpf,
        p.store_id,
        p.store_default,
        p.is_active,
        p.role,
        -- Normalizações para comparação
        LOWER(TRIM(p.name)) as name_normalized,
        LOWER(REPLACE(REPLACE(REPLACE(p.name, ' ', ''), '-', ''), '.', '')) as name_compact,
        -- Nome do vendedor do ERP
        'Yasmim Bruna Mendes Castro' as vendedor_erp_nome,
        LOWER(TRIM('Yasmim Bruna Mendes Castro')) as vendedor_erp_normalized,
        LOWER(REPLACE(REPLACE(REPLACE('Yasmim Bruna Mendes Castro', ' ', ''), '-', ''), '.', '')) as vendedor_erp_compact
    FROM sistemaretiradas.profiles p
    WHERE p.role = 'COLABORADORA'
        AND p.is_active = true
        AND (
            -- Busca exata (case-insensitive)
            LOWER(TRIM(p.name)) = LOWER(TRIM('Yasmim Bruna Mendes Castro'))
            -- Busca por primeiro nome
            OR LOWER(SPLIT_PART(p.name, ' ', 1)) = 'yasmim'
            -- Busca parcial (contém "Yasmim" ou "Bruna")
            OR LOWER(p.name) LIKE '%yasmim%'
            OR LOWER(p.name) LIKE '%bruna%'
        )
)
SELECT 
    '1. COLABORADORAS ENCONTRADAS' as etapa,
    cp.id,
    cp.name as nome_completo,
    cp.email,
    cp.cpf,
    cp.store_id,
    cp.store_default,
    cp.is_active,
    -- Loja vinculada
    s.name as loja_nome,
    s.id as loja_id,
    -- Comparação
    CASE 
        WHEN cp.name_normalized = cp.vendedor_erp_normalized THEN '✅ MATCH EXATO'
        WHEN cp.name_compact = cp.vendedor_erp_compact THEN '✅ MATCH COMPACTO'
        WHEN LOWER(SPLIT_PART(cp.name, ' ', 1)) = 'yasmim' THEN '⚠️ MATCH PRIMEIRO NOME'
        ELSE '⚠️ MATCH PARCIAL'
    END as tipo_match
FROM colaboradoras_possiveis cp
LEFT JOIN sistemaretiradas.stores s ON s.id::text = cp.store_id OR s.name = cp.store_default
ORDER BY 
    CASE 
        WHEN cp.name_normalized = cp.vendedor_erp_normalized THEN 1
        WHEN cp.name_compact = cp.vendedor_erp_compact THEN 2
        ELSE 3
    END;

-- 2. VERIFICAR PEDIDOS DO ERP COM MESMA VENDEDOR
SELECT 
    '2. PEDIDOS COM MESMA VENDEDOR' as etapa,
    t_ord.numero_pedido,
    t_ord.vendedor_nome,
    t_ord.data_pedido,
    t_ord.colaboradora_id,
    p.name as colaboradora_mapeada,
    CASE 
        WHEN t_ord.colaboradora_id IS NULL THEN '❌ NÃO MAPEADO'
        ELSE '✅ MAPEADO'
    END as status_mapeamento
FROM sistemaretiradas.tiny_orders t_ord
LEFT JOIN sistemaretiradas.profiles p ON p.id = t_ord.colaboradora_id
WHERE LOWER(t_ord.vendedor_nome) LIKE '%yasmim%'
   OR LOWER(t_ord.vendedor_nome) LIKE '%bruna%'
ORDER BY t_ord.data_pedido DESC
LIMIT 20;

-- 3. VERIFICAR TODAS AS COLABORADORAS DA LOJA
SELECT 
    '3. TODAS COLABORADORAS DA LOJA' as etapa,
    p.id,
    p.name,
    p.email,
    p.store_id,
    p.store_default,
    p.is_active,
    s.name as loja_nome,
    CASE 
        WHEN LOWER(p.name) LIKE '%yasmim%' OR LOWER(p.name) LIKE '%bruna%' THEN '⚠️ POSSÍVEL MATCH'
        ELSE '❌ NÃO É'
    END as possivel_match
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON s.id::text = p.store_id OR s.name = p.store_default
WHERE p.role = 'COLABORADORA'
    AND p.is_active = true
    AND (
        p.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text
        OR p.store_default = 'Sacada | Oh, Boy'
        OR s.id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
    )
ORDER BY p.name;

-- 4. VERIFICAR OUTRAS VENDEDORAS SEM MAPEAMENTO
SELECT 
    '4. VENDEDORAS SEM MAPEAMENTO' as etapa,
    t_ord.vendedor_nome,
    COUNT(*) as total_pedidos,
    MIN(t_ord.data_pedido) as primeiro_pedido,
    MAX(t_ord.data_pedido) as ultimo_pedido,
    COUNT(CASE WHEN t_ord.colaboradora_id IS NULL THEN 1 END) as pedidos_sem_mapeamento
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
    AND t_ord.vendedor_nome IS NOT NULL
GROUP BY t_ord.vendedor_nome
HAVING COUNT(CASE WHEN t_ord.colaboradora_id IS NULL THEN 1 END) > 0
ORDER BY pedidos_sem_mapeamento DESC, total_pedidos DESC;

