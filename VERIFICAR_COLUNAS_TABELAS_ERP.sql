-- =============================================================================
-- Script para verificar se todas as colunas necessárias existem nas tabelas
-- =============================================================================
-- Execute este script no Supabase para verificar a estrutura das tabelas
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. Verificar colunas de tiny_orders
-- =============================================================================
SELECT 
    'tiny_orders' as tabela,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
ORDER BY ordinal_position;

-- =============================================================================
-- 2. Verificar colunas de tiny_contacts
-- =============================================================================
SELECT 
    'tiny_contacts' as tabela,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_contacts'
ORDER BY ordinal_position;

-- =============================================================================
-- 3. Verificar dados de exemplo em tiny_orders
-- =============================================================================
SELECT 
    tiny_id,
    numero_pedido,
    valor_total,
    data_pedido,
    cliente_nome,
    cliente_cpf_cnpj,
    vendedor_nome,
    situacao,
    sync_at
FROM tiny_orders
ORDER BY sync_at DESC
LIMIT 5;

-- =============================================================================
-- 4. Verificar dados de exemplo em tiny_contacts
-- =============================================================================
SELECT 
    tiny_id,
    nome,
    cpf_cnpj,
    telefone,
    celular,
    data_nascimento,
    sync_at
FROM tiny_contacts
ORDER BY sync_at DESC
LIMIT 5;

-- =============================================================================
-- 5. Verificar se data_nascimento existe
-- =============================================================================
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'tiny_contacts' 
            AND column_name = 'data_nascimento'
        ) THEN '✅ Coluna data_nascimento EXISTE'
        ELSE '❌ Coluna data_nascimento NÃO EXISTE'
    END as status_data_nascimento;

-- =============================================================================
-- 6. Verificar tipos de dados críticos
-- =============================================================================
SELECT 
    'tiny_orders.valor_total' as campo,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
  AND column_name = 'valor_total'

UNION ALL

SELECT 
    'tiny_orders.data_pedido' as campo,
    data_type,
    NULL as numeric_precision,
    NULL as numeric_scale
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
  AND column_name = 'data_pedido';

