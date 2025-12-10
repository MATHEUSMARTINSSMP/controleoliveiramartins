-- =====================================================
-- VERIFICAR FUNÇÕES QUE OS TRIGGERS ANTIGOS ESTÃO CHAMANDO
-- =====================================================

-- Verificar se as funções check_notification_limit_insert e check_notification_limit_update existem
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as function_arguments,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND (
    proname = 'check_notification_limit_insert'
    OR proname = 'check_notification_limit_update'
    OR proname = 'check_store_notifications_dias_semana'
);

