-- =============================================================================
-- DIAGNÓSTICO: Verificar dados salvos nas tabelas ERP
-- =============================================================================
-- Execute este script no Supabase para verificar se os dados estão sendo salvos
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. Verificar últimos 5 pedidos salvos (com TODOS os campos)
-- =============================================================================
SELECT 
    'PEDIDOS' as tipo,
    tiny_id,
    numero_pedido,
    valor_total,
    data_pedido,
    cliente_nome,
    cliente_cpf_cnpj,
    cliente_email,
    cliente_telefone,
    vendedor_nome,
    situacao,
    sync_at,
    created_at,
    updated_at
FROM tiny_orders
ORDER BY sync_at DESC
LIMIT 5;

-- =============================================================================
-- 2. Verificar últimos 5 clientes salvos (com TODOS os campos)
-- =============================================================================
SELECT 
    'CLIENTES' as tipo,
    tiny_id,
    nome,
    cpf_cnpj,
    telefone,
    celular,
    email,
    data_nascimento,
    tipo as tipo_pessoa,
    sync_at,
    created_at,
    updated_at
FROM tiny_contacts
ORDER BY sync_at DESC
LIMIT 5;

-- =============================================================================
-- 3. Contar quantos pedidos têm valor_total > 0
-- =============================================================================
SELECT 
    'Pedidos com valor > 0' as metrica,
    COUNT(*) as total
FROM tiny_orders
WHERE valor_total > 0

UNION ALL

SELECT 
    'Pedidos com valor = 0 ou NULL' as metrica,
    COUNT(*) as total
FROM tiny_orders
WHERE valor_total IS NULL OR valor_total = 0;

-- =============================================================================
-- 4. Contar quantos pedidos têm data_pedido preenchida
-- =============================================================================
SELECT 
    'Pedidos com data preenchida' as metrica,
    COUNT(*) as total
FROM tiny_orders
WHERE data_pedido IS NOT NULL

UNION ALL

SELECT 
    'Pedidos sem data' as metrica,
    COUNT(*) as total
FROM tiny_orders
WHERE data_pedido IS NULL;

-- =============================================================================
-- 5. Contar quantos clientes têm CPF/CNPJ preenchido
-- =============================================================================
SELECT 
    'Clientes com CPF/CNPJ' as metrica,
    COUNT(*) as total
FROM tiny_contacts
WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != ''

UNION ALL

SELECT 
    'Clientes sem CPF/CNPJ' as metrica,
    COUNT(*) as total
FROM tiny_contacts
WHERE cpf_cnpj IS NULL OR cpf_cnpj = '';

-- =============================================================================
-- 6. Contar quantos clientes têm data_nascimento preenchida
-- =============================================================================
SELECT 
    'Clientes com data nascimento' as metrica,
    COUNT(*) as total
FROM tiny_contacts
WHERE data_nascimento IS NOT NULL

UNION ALL

SELECT 
    'Clientes sem data nascimento' as metrica,
    COUNT(*) as total
FROM tiny_contacts
WHERE data_nascimento IS NULL;

-- =============================================================================
-- 7. Verificar estrutura completa de um pedido (JSON)
-- =============================================================================
SELECT 
    'ESTRUTURA COMPLETA DO PRIMEIRO PEDIDO' as info,
    row_to_json(t) as dados_completos
FROM (
    SELECT * FROM tiny_orders LIMIT 1
) t;

-- =============================================================================
-- 8. Verificar estrutura completa de um cliente (JSON)
-- =============================================================================
SELECT 
    'ESTRUTURA COMPLETA DO PRIMEIRO CLIENTE' as info,
    row_to_json(t) as dados_completos
FROM (
    SELECT * FROM tiny_contacts LIMIT 1
) t;

