-- =====================================================
-- TESTAR INSERT DE REGISTRO DE PONTO COMO COLABORADORA
-- =====================================================
-- Execute este script LOGADO COMO A COLABORADORA para testar

-- 1. Verificar qual usuário está autenticado
SELECT 
    auth.uid() as user_id_autenticado,
    auth.role() as role_autenticado;

-- 2. Verificar perfil da colaboradora
SELECT 
    id,
    name,
    email,
    role,
    is_active,
    store_id,
    store_default
FROM sistemaretiradas.profiles
WHERE id = auth.uid();

-- 3. Verificar se a política permite INSERT
-- Esta query simula o que a política RLS verifica
SELECT 
    CASE 
        WHEN auth.uid() = '7835bdec-1cfa-44c4-a3a4-1e7b682a5ef5' 
             AND EXISTS (
                 SELECT 1 FROM sistemaretiradas.profiles
                 WHERE id = auth.uid()
                   AND role = 'COLABORADORA'
                   AND is_active = true
             )
        THEN '✅ Política permitiria INSERT'
        ELSE '❌ Política NÃO permitiria INSERT'
    END as teste_politica;

-- 4. Tentar inserir um registro de teste (será revertido)
-- NOTA: Execute apenas para testar, depois faça ROLLBACK
BEGIN;

INSERT INTO sistemaretiradas.time_clock_records (
    colaboradora_id,
    store_id,
    tipo_registro,
    horario
) VALUES (
    auth.uid(),  -- ID da colaboradora autenticada
    'c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3',  -- Store ID do Mr. Kitsch
    'ENTRADA',
    NOW()
) RETURNING *;

-- Se chegou aqui, o INSERT funcionou!
-- Faça ROLLBACK para não criar registro duplicado
ROLLBACK;

-- 5. Verificar políticas ativas
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_records'
  AND cmd = 'INSERT';

