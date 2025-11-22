-- TESTE DIRETO: Tentar desativar a colaboradora NAÍMA
-- Execute este SQL no Supabase SQL Editor logado como ADMIN

-- 1. Ver estado ANTES do update
SELECT 
    id, 
    name, 
    email, 
    role, 
    active,
    updated_at
FROM sistemaretiradas.profiles 
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9';

-- 2. Tentar fazer UPDATE
UPDATE sistemaretiradas.profiles 
SET active = false 
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9' 
RETURNING id, name, active, updated_at;

-- 3. Ver estado DEPOIS do update
SELECT 
    id, 
    name, 
    email, 
    role, 
    active,
    updated_at
FROM sistemaretiradas.profiles 
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9';

-- 4. Se o UPDATE funcionar aqui mas não funcionar no frontend,
--    o problema é na aplicação, não no banco de dados

-- 5. Verificar logs de RLS (se disponível)
-- Se houver erro de permissão, aparecerá aqui

