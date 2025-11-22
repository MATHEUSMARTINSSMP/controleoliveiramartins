-- Verificar se a função is_user_admin() está funcionando corretamente
-- Execute este SQL no Supabase como ADMIN para testar

-- 1. Ver a definição da função
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'is_user_admin';

-- 2. Testar se a função retorna true para ADMIN
-- (Execute isso logado como ADMIN)
SELECT 
    sistemaretiradas.is_user_admin() as is_admin,
    auth.uid() as current_user_id,
    (SELECT role FROM sistemaretiradas.profiles WHERE id = auth.uid()) as current_user_role;

-- 3. Verificar o perfil do usuário logado
SELECT 
    id,
    name,
    email,
    role,
    active
FROM sistemaretiradas.profiles
WHERE id = auth.uid();

-- 4. Testar UPDATE diretamente (descomente para testar)
-- IMPORTANTE: Execute isso logado como ADMIN
-- UPDATE sistemaretiradas.profiles 
-- SET active = false 
-- WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9' 
-- RETURNING id, name, active;

-- 5. Verificar se o UPDATE funcionou (execute depois do UPDATE acima)
-- SELECT id, name, active, updated_at
-- FROM sistemaretiradas.profiles 
-- WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9';

