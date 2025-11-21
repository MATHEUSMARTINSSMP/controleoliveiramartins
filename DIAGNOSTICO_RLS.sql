-- ============================================================
-- QUERIES DE DIAGNÓSTICO - Execute estas queries no Supabase SQL Editor
-- ============================================================

-- 1. Verificar se existem colaboradoras na tabela
SELECT 
    id, 
    name, 
    role, 
    active, 
    store_id, 
    store_default,
    created_at
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
ORDER BY name;

-- 2. Verificar colaboradoras da loja "Sacada | Oh, Boy" por store_id
SELECT 
    id, 
    name, 
    role, 
    active, 
    store_id, 
    store_default
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' 
  AND active = true
  AND store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4';

-- 3. Verificar TODAS as colaboradoras ativas (sem filtro de loja)
SELECT 
    id, 
    name, 
    role, 
    active, 
    store_id, 
    store_default
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA' 
  AND active = true
ORDER BY store_id, name;

-- 4. Verificar RLS policies na tabela profiles
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
ORDER BY policyname;

-- 5. Verificar se RLS está habilitado na tabela profiles
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'sistemaretiradas' 
  AND tablename = 'profiles';

-- 6. Contar colaboradoras por loja (store_id)
SELECT 
    s.name as store_name,
    s.id as store_id,
    COUNT(p.id) as total_colaboradoras,
    COUNT(CASE WHEN p.active = true THEN 1 END) as colaboradoras_ativas
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.store_id = s.id AND p.role = 'COLABORADORA'
GROUP BY s.id, s.name
ORDER BY s.name;

