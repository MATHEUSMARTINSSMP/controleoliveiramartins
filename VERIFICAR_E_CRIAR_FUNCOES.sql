-- ============================================================
-- VERIFICAR SE AS FUNÇÕES SECURITY DEFINER EXISTEM
-- ============================================================

-- 1. Verificar se as funções existem
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname IN ('get_user_role', 'is_user_loja', 'is_user_admin', 'get_loja_store_info', 'get_user_email')
ORDER BY p.proname;

-- 2. Testar se a função get_user_email() funciona
SELECT sistemaretiradas.get_user_email() as user_email;

-- 3. Testar se a função get_user_role() funciona
SELECT sistemaretiradas.get_user_role() as user_role;

-- 4. Testar se a função is_user_loja() funciona
SELECT sistemaretiradas.is_user_loja() as is_loja;

-- 5. Verificar se há permissões (GRANT) para as funções
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    r.rolname as grantee,
    has_function_privilege(r.rolname, p.oid, 'EXECUTE') as has_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname IN ('get_user_role', 'is_user_loja', 'is_user_admin', 'get_loja_store_info', 'get_user_email')
  AND r.rolname = 'authenticated'
ORDER BY p.proname;

