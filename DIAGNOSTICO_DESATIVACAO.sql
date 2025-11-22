-- DIAGNÓSTICO: Por que a colaboradora NAÍMA não está sendo desativada?

-- 1. Verificar o estado atual da colaboradora NAÍMA
SELECT 
    id, 
    name, 
    email, 
    role, 
    active, 
    store_id,
    store_default,
    created_at,
    updated_at
FROM sistemaretiradas.profiles 
WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9';

-- 2. Verificar se há vendas associadas a esta colaboradora
SELECT 
    COUNT(*) as total_vendas,
    SUM(valor) as total_vendido
FROM sistemaretiradas.sales
WHERE colaboradora_id = '91192cc7-4865-43d1-9194-0544438ed6d9';

-- 3. Verificar se há metas associadas a esta colaboradora
SELECT 
    COUNT(*) as total_metas,
    tipo,
    mes_referencia,
    semana_referencia,
    ativo
FROM sistemaretiradas.goals
WHERE colaboradora_id = '91192cc7-4865-43d1-9194-0544438ed6d9'
GROUP BY tipo, mes_referencia, semana_referencia, ativo;

-- 4. Verificar políticas RLS de UPDATE na tabela profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles'
  AND cmd = 'UPDATE';

-- 5. Verificar se RLS está habilitado na tabela profiles
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles';

-- 6. Verificar constraints na tabela profiles que podem impedir UPDATE
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.profiles'::regclass
  AND contype IN ('c', 'f', 'u', 'p'); -- c=check, f=foreign key, u=unique, p=primary key

-- 7. Verificar triggers na tabela profiles
SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'sistemaretiradas'
  AND event_object_table = 'profiles';

-- 8. TENTAR DESATIVAR MANUALMENTE (se as políticas permitirem)
-- Descomente a linha abaixo para testar:
-- UPDATE sistemaretiradas.profiles SET active = false WHERE id = '91192cc7-4865-43d1-9194-0544438ed6d9' RETURNING *;

