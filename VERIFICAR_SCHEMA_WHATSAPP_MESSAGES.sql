-- Script SQL para verificar e corrigir schema da tabela whatsapp_messages
-- Schema: elevea
-- Execute este script no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR ESTRUTURA ATUAL DA TABELA
-- ============================================

-- Verificar se a tabela existe
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'elevea'
  AND table_name = 'whatsapp_messages'
ORDER BY ordinal_position;

-- ============================================
-- 2. VERIFICAR CONSTRAINT DE MENSAGEM
-- ============================================

-- Verificar constraints da coluna message
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
    AND tc.table_schema = cc.constraint_schema
WHERE tc.table_schema = 'elevea'
  AND tc.table_name = 'whatsapp_messages'
  AND tc.constraint_type = 'CHECK';

-- ============================================
-- 3. VERIFICAR TIPO DE DADOS
-- ============================================

-- Verificar se message e message_text são TEXT ou VARCHAR
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    CASE 
        WHEN data_type = 'text' THEN '✅ Aceita emojis e caracteres especiais'
        WHEN data_type = 'varchar' AND character_maximum_length IS NULL THEN '✅ Aceita emojis (sem limite)'
        WHEN data_type = 'varchar' THEN '⚠️ Pode ter limitação de tamanho: ' || character_maximum_length || ' caracteres'
        ELSE '❓ Tipo desconhecido: ' || data_type
    END as observacao
FROM information_schema.columns
WHERE table_schema = 'elevea'
  AND table_name = 'whatsapp_messages'
  AND column_name IN ('message', 'message_text');

-- ============================================
-- 4. VERIFICAR ENCODING DA TABELA
-- ============================================

-- Verificar encoding da tabela (deve ser UTF8 para suportar emojis)
SELECT 
    t.table_schema,
    t.table_name,
    d.datname as database_name,
    pg_encoding_to_char(d.encoding) as database_encoding,
    CASE 
        WHEN pg_encoding_to_char(d.encoding) = 'UTF8' THEN '✅ Encoding UTF8 - Suporta emojis'
        ELSE '⚠️ Encoding: ' || pg_encoding_to_char(d.encoding) || ' - Pode não suportar emojis'
    END as observacao
FROM information_schema.tables t
JOIN pg_database d ON d.datname = current_database()
WHERE t.table_schema = 'elevea'
  AND t.table_name = 'whatsapp_messages';

-- ============================================
-- 5. TESTE DE INSERÇÃO COM EMOJI (OPCIONAL)
-- ============================================

-- Testar se é possível inserir mensagem com emoji no início
-- Descomente para testar (remova após verificar)
/*
INSERT INTO elevea.whatsapp_messages (
    customer_id, 
    site_slug, 
    phone_number, 
    message, 
    message_text,
    direction, 
    message_type, 
    message_id, 
    timestamp, 
    uazapi_instance_id,
    status
)
VALUES (
    'test@example.com',
    'elevea',
    '5596999999999',
    '🛒 *Nova Venda Lançada* Teste de emoji no início',
    '🛒 *Nova Venda Lançada* Teste de emoji no início',
    'outbound',
    'text',
    'msg_test_' || extract(epoch from now())::bigint,
    NOW(),
    'rc8a4cb18c4cf39',
    'active'
)
RETURNING message_id, message;
*/

-- ============================================
-- 6. CORRIGIR SCHEMA SE NECESSÁRIO (APENAS SE PRECISAR)
-- ============================================

-- Se message ou message_text forem VARCHAR com tamanho limitado, 
-- altere para TEXT para aceitar qualquer tamanho e emojis
/*
ALTER TABLE elevea.whatsapp_messages
ALTER COLUMN message TYPE TEXT,
ALTER COLUMN message_text TYPE TEXT;
*/

-- ============================================
-- RESUMO
-- ============================================
-- ✅ Este script verifica se a tabela suporta emojis
-- ✅ PostgreSQL com encoding UTF8 suporta emojis nativamente
-- ✅ Colunas do tipo TEXT ou VARCHAR sem limite aceitam emojis
-- ⚠️ O erro "invalid input syntax for type bigint: 'text'" não é sobre emoji,
--    mas sim sobre mapeamento incorreto de parâmetros no n8n

