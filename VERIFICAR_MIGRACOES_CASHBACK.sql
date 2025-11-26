-- =============================================================================
-- VERIFICAÇÃO COMPLETA DAS MIGRAÇÕES DE CASHBACK
-- =============================================================================
-- Execute este script para verificar se todas as migrações foram aplicadas corretamente
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. VERIFICAR SE AS TABELAS EXISTEM
-- =============================================================================

SELECT 
    '✅ TABELAS' as categoria,
    table_name as item,
    CASE 
        WHEN table_name IN ('cashback_transactions', 'cashback_balance', 'cashback_settings') 
        THEN '✅ EXISTE' 
        ELSE '❌ NÃO ENCONTRADA' 
    END as status
FROM information_schema.tables 
WHERE table_schema = 'sistemaretiradas' 
AND table_name LIKE 'cashback%'
ORDER BY table_name;

-- =============================================================================
-- 2. VERIFICAR COLUNAS DE cashback_transactions
-- =============================================================================

SELECT 
    '✅ COLUNAS (cashback_transactions)' as categoria,
    column_name as item,
    data_type as tipo,
    is_nullable as nullable,
    CASE 
        WHEN column_name IN ('cliente_id', 'tiny_order_id', 'data_liberacao', 'data_expiracao', 
                             'renovado', 'recuperado', 'cashback_settings_id', 'colaboradora_id') 
        THEN '✅ EXISTE' 
        ELSE '⚠️ Verificar' 
    END as status
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'cashback_transactions'
ORDER BY column_name;

-- =============================================================================
-- 3. VERIFICAR COLUNAS DE cashback_balance
-- =============================================================================

SELECT 
    '✅ COLUNAS (cashback_balance)' as categoria,
    column_name as item,
    data_type as tipo,
    is_nullable as nullable,
    CASE 
        WHEN column_name IN ('cliente_id', 'store_id', 'balance_disponivel', 'balance_pendente',
                             'data_expiracao_proximo', 'valor_expiracao_proximo', 'colaboradora_id') 
        THEN '✅ EXISTE' 
        ELSE '⚠️ Verificar' 
    END as status
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'cashback_balance'
ORDER BY column_name;

-- =============================================================================
-- 4. VERIFICAR COLUNAS DE cashback_settings
-- =============================================================================

SELECT 
    '✅ COLUNAS (cashback_settings)' as categoria,
    column_name as item,
    data_type as tipo,
    CASE 
        WHEN column_name IN ('store_id', 'prazo_liberacao_dias', 'prazo_expiracao_dias',
                             'percentual_cashback', 'percentual_uso_maximo', 'renovacao_habilitada',
                             'renovacao_dias', 'observacoes') 
        THEN '✅ EXISTE' 
        ELSE '⚠️ Verificar' 
    END as status
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'cashback_settings'
ORDER BY column_name;

-- =============================================================================
-- 5. VERIFICAR FUNÇÕES CRIADAS
-- =============================================================================

SELECT 
    '✅ FUNÇÕES' as categoria,
    routine_name as item,
    routine_type as tipo,
    '✅ EXISTE' as status
FROM information_schema.routines 
WHERE routine_schema = 'sistemaretiradas' 
AND routine_name IN (
    'calculate_cashback_for_tiny_order',
    'update_cashback_balances_on_liberation',
    'renovar_cashback',
    'get_cashback_summary_for_client',
    'get_cashback_history_for_client'
)
ORDER BY routine_name;

-- =============================================================================
-- 6. VERIFICAR TRIGGERS
-- =============================================================================

SELECT 
    '✅ TRIGGERS' as categoria,
    trigger_name as item,
    event_object_table as tabela,
    action_timing as timing,
    event_manipulation as evento,
    '✅ EXISTE' as status
FROM information_schema.triggers 
WHERE trigger_schema = 'sistemaretiradas' 
AND trigger_name LIKE '%cashback%'
ORDER BY trigger_name;

-- =============================================================================
-- 7. VERIFICAR ÍNDICES CRIADOS
-- =============================================================================

SELECT 
    '✅ ÍNDICES' as categoria,
    indexname as item,
    tablename as tabela,
    '✅ EXISTE' as status
FROM pg_indexes 
WHERE schemaname = 'sistemaretiradas' 
AND (indexname LIKE '%cashback%' OR tablename LIKE '%cashback%')
ORDER BY tablename, indexname;

-- =============================================================================
-- 8. VERIFICAR CONSTRAINTS (UNIQUE, CHECK, FOREIGN KEY)
-- =============================================================================

-- Constraint CHECK em cashback_balance
SELECT 
    '✅ CONSTRAINTS' as categoria,
    conname as constraint_name,
    contype as tipo,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        ELSE 'OUTRO'
    END as tipo_desc,
    conrelid::regclass as tabela,
    '✅ EXISTE' as status
FROM pg_constraint 
WHERE connamespace = 'sistemaretiradas'::regnamespace
AND (
    conname LIKE '%cashback%' 
    OR conrelid::regclass::text LIKE '%cashback%'
)
ORDER BY conname;

-- =============================================================================
-- 9. VERIFICAR POLÍTICAS RLS
-- =============================================================================

SELECT 
    '✅ POLÍTICAS RLS' as categoria,
    policyname as politica,
    tablename as tabela,
    cmd as comando,
    '✅ EXISTE' as status
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
AND tablename LIKE '%cashback%'
ORDER BY tablename, policyname;

-- =============================================================================
-- 10. VERIFICAR SE RLS ESTÁ HABILITADO
-- =============================================================================

SELECT 
    '✅ RLS HABILITADO' as categoria,
    tablename as tabela,
    rowsecurity as rls_habilitado,
    CASE 
        WHEN rowsecurity THEN '✅ SIM' 
        ELSE '❌ NÃO' 
    END as status
FROM pg_tables 
WHERE schemaname = 'sistemaretiradas' 
AND tablename LIKE '%cashback%'
ORDER BY tablename;

-- =============================================================================
-- 11. TESTE: VERIFICAR ESTRUTURA COMPLETA DE cashback_transactions
-- =============================================================================

SELECT 
    '📋 DETALHES COMPLETOS' as categoria,
    'cashback_transactions' as tabela,
    column_name as coluna,
    data_type as tipo,
    character_maximum_length as tamanho,
    is_nullable as nullable,
    column_default as default_value
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'cashback_transactions'
ORDER BY ordinal_position;

-- =============================================================================
-- 12. TESTE: VERIFICAR ESTRUTURA COMPLETA DE cashback_balance
-- =============================================================================

SELECT 
    '📋 DETALHES COMPLETOS' as categoria,
    'cashback_balance' as tabela,
    column_name as coluna,
    data_type as tipo,
    character_maximum_length as tamanho,
    is_nullable as nullable,
    column_default as default_value
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'cashback_balance'
ORDER BY ordinal_position;

-- =============================================================================
-- 13. TESTE: VERIFICAR FOREIGN KEYS
-- =============================================================================

SELECT 
    '🔗 FOREIGN KEYS' as categoria,
    tc.constraint_name as constraint_name,
    tc.table_name as tabela_origem,
    kcu.column_name as coluna_origem,
    ccu.table_name AS tabela_destino,
    ccu.column_name AS coluna_destino,
    '✅ EXISTE' as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'sistemaretiradas'
AND (tc.table_name LIKE '%cashback%' OR ccu.table_name LIKE '%cashback%')
ORDER BY tc.table_name, tc.constraint_name;

-- =============================================================================
-- 14. TESTE: CONTAR REGISTROS NAS TABELAS (se houver dados)
-- =============================================================================

SELECT 
    '📊 CONTAGEM DE REGISTROS' as categoria,
    'cashback_transactions' as tabela,
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ TEM DADOS' 
        ELSE '⚠️ VAZIA (normal se ainda não houver transações)' 
    END as status
FROM cashback_transactions

UNION ALL

SELECT 
    '📊 CONTAGEM DE REGISTROS' as categoria,
    'cashback_balance' as tabela,
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ TEM DADOS' 
        ELSE '⚠️ VAZIA (normal se ainda não houver saldos)' 
    END as status
FROM cashback_balance

UNION ALL

SELECT 
    '📊 CONTAGEM DE REGISTROS' as categoria,
    'cashback_settings' as tabela,
    COUNT(*) as total_registros,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ TEM DADOS' 
        ELSE '❌ VAZIA (deveria ter pelo menos uma configuração padrão)' 
    END as status
FROM cashback_settings;

-- =============================================================================
-- 15. TESTE: VERIFICAR CONFIGURAÇÃO PADRÃO DE CASHBACK
-- =============================================================================

SELECT 
    '⚙️ CONFIGURAÇÃO PADRÃO' as categoria,
    id,
    CASE 
        WHEN store_id IS NULL THEN 'Global' 
        ELSE 'Por Loja: ' || store_id::text 
    END as tipo,
    prazo_liberacao_dias,
    prazo_expiracao_dias,
    percentual_cashback,
    percentual_uso_maximo,
    renovacao_habilitada,
    '✅ EXISTE' as status
FROM cashback_settings
ORDER BY store_id NULLS FIRST;

-- =============================================================================
-- 16. RESUMO FINAL - CHECKLIST
-- =============================================================================

SELECT 
    '✅ CHECKLIST FINAL' as categoria,
    item,
    CASE 
        WHEN status THEN '✅ OK' 
        ELSE '❌ FALTANDO' 
    END as resultado
FROM (
    SELECT 'Tabela cashback_transactions existe' as item, 
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_transactions') as status
    UNION ALL
    SELECT 'Tabela cashback_balance existe', 
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_balance')
    UNION ALL
    SELECT 'Tabela cashback_settings existe', 
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_settings')
    UNION ALL
    SELECT 'Coluna cliente_id em cashback_transactions', 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_transactions' AND column_name = 'cliente_id')
    UNION ALL
    SELECT 'Coluna tiny_order_id em cashback_transactions', 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_transactions' AND column_name = 'tiny_order_id')
    UNION ALL
    SELECT 'Coluna cliente_id em cashback_balance', 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_balance' AND column_name = 'cliente_id')
    UNION ALL
    SELECT 'Coluna store_id em cashback_balance', 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sistemaretiradas' AND table_name = 'cashback_balance' AND column_name = 'store_id')
    UNION ALL
    SELECT 'Função calculate_cashback_for_tiny_order', 
           EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'sistemaretiradas' AND routine_name = 'calculate_cashback_for_tiny_order')
    UNION ALL
    SELECT 'Função renovar_cashback', 
           EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'sistemaretiradas' AND routine_name = 'renovar_cashback')
    UNION ALL
    SELECT 'Trigger trigger_calculate_cashback_tiny_order', 
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_schema = 'sistemaretiradas' AND trigger_name = 'trigger_calculate_cashback_tiny_order')
    UNION ALL
    SELECT 'RLS habilitado em cashback_transactions', 
           EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sistemaretiradas' AND tablename = 'cashback_transactions' AND rowsecurity)
    UNION ALL
    SELECT 'RLS habilitado em cashback_balance', 
           EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sistemaretiradas' AND tablename = 'cashback_balance' AND rowsecurity)
    UNION ALL
    SELECT 'RLS habilitado em cashback_settings', 
           EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'sistemaretiradas' AND tablename = 'cashback_settings' AND rowsecurity)
) as checklist
ORDER BY status DESC, item;

-- =============================================================================
-- FIM DA VERIFICAÇÃO
-- =============================================================================

-- 📝 NOTA: Se todos os itens do checklist final estiverem marcados como ✅ OK,
--          significa que todas as migrações foram aplicadas com sucesso!

