-- ============================================================
-- VERIFICAÇÃO COMPLETA: Por que Yasmim Bruna não foi mapeada?
-- ============================================================

-- 1. VERIFICAR SE A COLABORADORA EXISTE E ESTÁ CONFIGURADA CORRETAMENTE
SELECT 
    '1. COLABORADORA NO SISTEMA' as etapa,
    p.id,
    p.name,
    p.email,
    p.cpf,
    p.role,
    p.is_active,
    p.store_id as store_id_uuid,
    p.store_default as store_default_nome,
    -- Verificar loja vinculada
    s.id as loja_id_real,
    s.name as loja_nome_real,
    CASE 
        WHEN p.store_id::text = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text THEN '✅ VINCULADA DIRETO POR UUID'
        WHEN s.id::uuid = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid THEN '✅ VINCULADA POR NOME'
        WHEN p.store_id IS NULL AND p.store_default IS NULL THEN '❌ SEM VINCULAÇÃO'
        ELSE '⚠️ VINCULADA A OUTRA LOJA'
    END as status_vinculacao,
    -- Teste de normalização (como no código)
    LOWER(
        REGEXP_REPLACE(
            UNACCENT(p.name),
            '[^a-z0-9\s]', '', 'g'
        )
    ) as nome_normalizado_codigo,
    LOWER(
        REGEXP_REPLACE(
            UNACCENT('Yasmim Bruna Mendes Castro'),
            '[^a-z0-9\s]', '', 'g'
        )
    ) as nome_erp_normalizado,
    CASE 
        WHEN LOWER(
            REGEXP_REPLACE(
                UNACCENT(p.name),
                '[^a-z0-9\s]', '', 'g'
            )
        ) = LOWER(
            REGEXP_REPLACE(
                UNACCENT('Yasmim Bruna Mendes Castro'),
                '[^a-z0-9\s]', '', 'g'
            )
        ) THEN '✅ MATCH NORMALIZADO'
        ELSE '❌ NÃO MATCH'
    END as teste_normalizacao
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON (
    s.id::text = p.store_id::text
    OR s.name = p.store_default
)
WHERE p.role = 'COLABORADORA'
    AND (
        LOWER(p.name) LIKE '%yasmim%'
        OR LOWER(p.name) LIKE '%bruna%'
        OR p.name = 'Yasmim Bruna Mendes Castro'
    );

-- 2. VERIFICAR TODAS AS COLABORADORAS DA LOJA (como o código busca)
SELECT 
    '2. COLABORADORAS BUSCADAS PELO CÓDIGO' as etapa,
    p.id,
    p.name,
    p.email,
    p.cpf,
    p.is_active,
    p.store_id,
    p.store_default,
    CASE 
        WHEN p.store_id::text = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text THEN '✅ POR UUID'
        WHEN s.id::uuid = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid THEN '✅ POR NOME'
        ELSE '❌ NÃO É DESTA LOJA'
    END as status,
    -- Simular a busca do código (.eq('store_id', storeId))
    CASE 
        WHEN p.store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text THEN '✅ SERIA ENCONTRADA'
        ELSE '❌ NÃO SERIA ENCONTRADA (store_id diferente)'
    END as seria_encontrada_pelo_codigo
FROM sistemaretiradas.profiles p
LEFT JOIN sistemaretiradas.stores s ON (s.id::text = p.store_id::text OR s.name = p.store_default)
WHERE p.role = 'COLABORADORA'
    AND p.is_active = true
    AND (
        -- Como o código busca: .eq('store_id', storeId)
        p.store_id::text = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::text
        -- OU se a loja está vinculada por nome
        OR s.id::uuid = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'::uuid
    );

-- 3. VERIFICAR O PEDIDO ESPECÍFICO
SELECT 
    '3. DADOS DO PEDIDO 1449' as etapa,
    t_ord.numero_pedido,
    t_ord.vendedor_nome,
    t_ord.vendedor_tiny_id,
    t_ord.store_id as store_id_pedido,
    t_ord.colaboradora_id,
    t_ord.data_pedido,
    -- Verificar se há colaboradora com esse nome na loja
    (
        SELECT COUNT(*) 
        FROM sistemaretiradas.profiles p2
        WHERE p2.role = 'COLABORADORA'
            AND p2.is_active = true
            AND p2.store_id::text = t_ord.store_id::text
            AND LOWER(
                REGEXP_REPLACE(
                    UNACCENT(p2.name),
                    '[^a-z0-9\s]', '', 'g'
                )
            ) = LOWER(
                REGEXP_REPLACE(
                    UNACCENT(t_ord.vendedor_nome),
                    '[^a-z0-9\s]', '', 'g'
                )
            )
    ) as colaboradoras_com_mesmo_nome_na_loja
FROM sistemaretiradas.tiny_orders t_ord
WHERE t_ord.numero_pedido::text = '1449';

-- 4. TESTAR A FUNÇÃO DE NORMALIZAÇÃO (como no código JavaScript)
-- O código JavaScript usa: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
-- Em SQL, usamos UNACCENT que faz algo similar
SELECT 
    '4. TESTE DE NORMALIZAÇÃO' as etapa,
    'Yasmim Bruna Mendes Castro' as nome_original,
    LOWER('Yasmim Bruna Mendes Castro') as lowercase,
    UNACCENT(LOWER('Yasmim Bruna Mendes Castro')) as sem_acentos,
    TRIM(UNACCENT(LOWER('Yasmim Bruna Mendes Castro'))) as normalizado_final,
    -- Comparar com nomes do sistema
    p.name as nome_sistema,
    LOWER(TRIM(UNACCENT(p.name))) as sistema_normalizado,
    CASE 
        WHEN LOWER(TRIM(UNACCENT('Yasmim Bruna Mendes Castro'))) = LOWER(TRIM(UNACCENT(p.name))) 
        THEN '✅ MATCH'
        ELSE '❌ NÃO MATCH'
    END as match
FROM sistemaretiradas.profiles p
WHERE p.role = 'COLABORADORA'
    AND (
        LOWER(p.name) LIKE '%yasmim%'
        OR LOWER(p.name) LIKE '%bruna%'
    );

