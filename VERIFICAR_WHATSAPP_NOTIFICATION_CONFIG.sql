-- Script para verificar dados e políticas RLS da tabela whatsapp_notification_config

-- ============================================
-- 1. VERIFICAR SE A TABELA EXISTE
-- ============================================
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_schema = 'sistemaretiradas'
AND table_name = 'whatsapp_notification_config';

-- ============================================
-- 2. VERIFICAR ESTRUTURA DA TABELA
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
AND table_name = 'whatsapp_notification_config'
ORDER BY ordinal_position;

-- ============================================
-- 3. CONTAR TOTAL DE REGISTROS
-- ============================================
SELECT COUNT(*) as total_registros
FROM sistemaretiradas.whatsapp_notification_config;

-- ============================================
-- 4. LISTAR TODOS OS REGISTROS
-- ============================================
SELECT 
    id,
    admin_id,
    notification_type,
    phone,
    store_id,
    active,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_notification_config
ORDER BY created_at DESC;

-- ============================================
-- 5. VERIFICAR POLÍTICAS RLS
-- ============================================
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
AND tablename = 'whatsapp_notification_config';

-- ============================================
-- 6. VERIFICAR SE RLS ESTÁ HABILITADO
-- ============================================
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
AND tablename = 'whatsapp_notification_config';

-- ============================================
-- 7. VERIFICAR CONSTRAINTS
-- ============================================
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.whatsapp_notification_config'::regclass;

-- ============================================
-- 8. VERIFICAR ADMIN IDs NA TABELA
-- ============================================
SELECT DISTINCT 
    admin_id,
    COUNT(*) as total_configs
FROM sistemaretiradas.whatsapp_notification_config
GROUP BY admin_id
ORDER BY total_configs DESC;

-- ============================================
-- 9. VERIFICAR SE HÁ REGISTROS PARA UM ADMIN ESPECÍFICO
-- ============================================
-- Substitua 'SEU_ADMIN_ID_AQUI' pelo ID do admin
SELECT 
    id,
    notification_type,
    phone,
    store_id,
    active
FROM sistemaretiradas.whatsapp_notification_config
WHERE admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'::uuid
ORDER BY notification_type, created_at;

