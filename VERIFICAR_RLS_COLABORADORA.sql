-- =====================================================
-- VERIFICAR POLÍTICAS RLS PARA COLABORADORAS
-- =====================================================
-- Execute este script para verificar se as políticas estão corretas

-- 1. Verificar políticas existentes para time_clock_records
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
  AND tablename = 'time_clock_records'
ORDER BY policyname;

-- 2. Verificar se a colaboradora existe e está ativa
SELECT 
    id,
    name,
    email,
    role,
    is_active,
    store_id,
    store_default
FROM sistemaretiradas.profiles
WHERE role = 'COLABORADORA'
  AND is_active = true
ORDER BY name;

-- 3. Verificar se há registros de ponto para a colaboradora
SELECT 
    id,
    colaboradora_id,
    store_id,
    tipo_registro,
    horario,
    created_at
FROM sistemaretiradas.time_clock_records
WHERE colaboradora_id = '7835bdec-1cfa-44c4-a3a4-1e7b682a5ef5'  -- ID da Fernanda
ORDER BY horario DESC
LIMIT 10;

-- 4. Testar se a política permite INSERT (simulação)
-- NOTA: Execute como a própria colaboradora para testar
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE id = auth.uid()
              AND role = 'COLABORADORA'
              AND is_active = true
        ) THEN '✅ Colaboradora ativa encontrada'
        ELSE '❌ Colaboradora não encontrada ou inativa'
    END as status_colaboradora;

-- 5. Verificar RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_records';

