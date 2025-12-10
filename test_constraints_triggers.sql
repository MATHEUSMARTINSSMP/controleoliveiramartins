-- =====================================================
-- TESTE: VERIFICAR CONSTRAINTS E TRIGGERS
-- =====================================================

-- 1. Verificar constraints CHECK na tabela store_notifications
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.store_notifications'::regclass
AND contype = 'c'  -- CHECK constraint
AND (
    pg_get_constraintdef(oid) LIKE '%validate%'
    OR pg_get_constraintdef(oid) LIKE '%notification%'
    OR pg_get_constraintdef(oid) LIKE '%limit%'
);

-- 2. Verificar triggers na tabela store_notifications
SELECT 
    tgname as trigger_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.store_notifications'::regclass
AND NOT tgisinternal  -- Apenas triggers criados pelo usuário
AND (
    pg_get_triggerdef(oid) LIKE '%validate%'
    OR pg_get_triggerdef(oid) LIKE '%notification%'
    OR pg_get_triggerdef(oid) LIKE '%limit%'
);

-- 3. Verificar triggers na tabela store_notification_recipients
SELECT 
    tgname as trigger_name,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'sistemaretiradas.store_notification_recipients'::regclass
AND NOT tgisinternal  -- Apenas triggers criados pelo usuário
AND (
    pg_get_triggerdef(oid) LIKE '%validate%'
    OR pg_get_triggerdef(oid) LIKE '%notification%'
    OR pg_get_triggerdef(oid) LIKE '%limit%'
);

-- 4. Verificar se há alguma função validate_notification_limit (SEM _store_)
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as function_arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND proname = 'validate_notification_limit';  -- SEM _store_

