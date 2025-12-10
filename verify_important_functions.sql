-- =====================================================
-- VERIFICAÇÃO: FUNÇÕES IMPORTANTES DO SISTEMA
-- =====================================================
-- Esta query verifica se todas as funções críticas ainda existem
-- após as migrações de limpeza

-- 1. FUNÇÕES DE WHATSAPP
SELECT 
    'WHATSAPP' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '❌ FALTANDO'
        ELSE '✅ EXISTE'
    END as status
FROM (
    SELECT 'enqueue_cashback_whatsapp' as function_name
    UNION SELECT 'enviar_whatsapp_cashback'
    UNION SELECT 'processar_fila_whatsapp_direto'
    UNION SELECT 'processar_fila_whatsapp_cashback'
    UNION SELECT 'chamar_processar_fila_whatsapp'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

-- 2. FUNÇÕES DE CASHBACK
SELECT 
    'CASHBACK' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '❌ FALTANDO'
        ELSE '✅ EXISTE'
    END as status
FROM (
    SELECT 'gerar_cashback' as function_name
    UNION SELECT 'atualizar_saldos_cashback'
    UNION SELECT 'atualizar_saldo_cliente_cashback'
    UNION SELECT 'lancar_cashback_manual'
    UNION SELECT 'resgatar_cashback_manual'
    UNION SELECT 'cancelar_transacao_cashback'
    UNION SELECT 'renovar_cashback'
    UNION SELECT 'expirar_cashback_vencido'
    UNION SELECT 'get_cashback_settings'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

-- 3. FUNÇÕES DE SINCRONIZAÇÃO (ERP)
SELECT 
    'SYNC' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '❌ FALTANDO'
        ELSE '✅ EXISTE'
    END as status
FROM (
    SELECT 'chamar_sync_tiny_orders' as function_name
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

-- 4. FUNÇÕES DE PROCESSAMENTO DE ALERTAS
SELECT 
    'ALERTAS' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '❌ FALTANDO'
        ELSE '✅ EXISTE'
    END as status
FROM (
    SELECT 'process_store_task_alerts' as function_name
    UNION SELECT 'chamar_processar_alertas'
    UNION SELECT 'reset_daily_sends'
    UNION SELECT 'diagnosticar_sistema_alertas'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

-- 5. FUNÇÕES DE VALIDAÇÃO (DEVEM EXISTIR - AS NOVAS)
SELECT 
    'VALIDAÇÃO (NOVAS)' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '❌ FALTANDO'
        ELSE '✅ EXISTE'
    END as status
FROM (
    SELECT 'validate_store_notification_limit' as function_name
    UNION SELECT 'validate_store_notification_limit_after_recipient_change'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

-- 6. FUNÇÕES QUE NÃO DEVEM EXISTIR (AS ANTIGAS)
SELECT 
    'VALIDAÇÃO (ANTIGAS - NÃO DEVEM EXISTIR)' as categoria,
    expected.function_name,
    CASE 
        WHEN p.proname IS NULL THEN '✅ CORRETO (não existe)'
        ELSE '❌ AINDA EXISTE (deve ser removida)'
    END as status
FROM (
    SELECT 'validate_notification_limit' as function_name
    UNION SELECT 'check_notification_limit_insert'
    UNION SELECT 'check_notification_limit_update'
) expected
LEFT JOIN pg_proc p ON p.proname = expected.function_name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
ORDER BY categoria, expected.function_name;

