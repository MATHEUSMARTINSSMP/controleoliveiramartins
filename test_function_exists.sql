-- =====================================================
-- TESTE: VERIFICAR SE A FUNÇÃO EXISTE
-- =====================================================

-- Verificar se a função validate_notification_limit existe
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as function_arguments,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND (
    proname = 'validate_notification_limit'
    OR proname LIKE '%validate%notification%limit%'
)
ORDER BY proname, pg_get_function_arguments(oid);

-- Se retornar vazio, a função NÃO existe
-- Se retornar linhas, a função EXISTE e mostra os detalhes

