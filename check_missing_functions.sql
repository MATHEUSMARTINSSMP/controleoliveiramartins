-- =====================================================
-- VERIFICAR FUNÇÕES FALTANTES COM TODAS AS ASSINATURAS
-- =====================================================

-- 1. Verificar processar_fila_whatsapp_cashback (pode ter parâmetros)
SELECT 
    'processar_fila_whatsapp_cashback' as function_name,
    proname,
    pg_get_function_arguments(oid) as function_arguments,
    pg_get_function_identity_arguments(oid) as identity_arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND proname LIKE '%processar_fila_whatsapp%'
ORDER BY proname, pg_get_function_arguments(oid);

-- 2. Verificar processar_fila_whatsapp_direto (pode ter parâmetros)
SELECT 
    'processar_fila_whatsapp_direto' as function_name,
    proname,
    pg_get_function_arguments(oid) as function_arguments,
    pg_get_function_identity_arguments(oid) as identity_arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND proname LIKE '%processar_fila_whatsapp_direto%'
ORDER BY proname, pg_get_function_arguments(oid);

-- 3. Verificar cancelar_transacao_cashback (pode ter parâmetros)
SELECT 
    'cancelar_transacao_cashback' as function_name,
    proname,
    pg_get_function_arguments(oid) as function_arguments,
    pg_get_function_identity_arguments(oid) as identity_arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND proname LIKE '%cancelar_transacao%'
ORDER BY proname, pg_get_function_arguments(oid);

-- 4. Verificar TODAS as funções relacionadas a whatsapp
SELECT 
    proname,
    pg_get_function_arguments(oid) as function_arguments
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
AND (
    proname LIKE '%whatsapp%'
    OR proname LIKE '%fila%'
)
ORDER BY proname;

