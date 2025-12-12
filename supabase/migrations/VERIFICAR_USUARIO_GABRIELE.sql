-- ============================================================================
-- VERIFICAÇÃO DE EMERGÊNCIA - USUÁRIO GABRIELE
-- Execute este script no SQL Editor do Supabase
-- ============================================================================

-- 1. Verificar dados do usuário no Auth
SELECT 
    id as user_id,
    email,
    email_confirmed_at,
    phone_confirmed_at,
    confirmed_at,
    created_at,
    last_sign_in_at,
    banned_until,
    deleted_at,
    is_sso_user,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users
WHERE email = 'gabrieleferreirabobato@gmail.com';

-- 2. Verificar profile no sistemaretiradas
SELECT 
    id,
    name,
    email,
    role,
    active,
    is_active,
    store_id,
    store_default,
    created_at
FROM sistemaretiradas.profiles
WHERE email = 'gabrieleferreirabobato@gmail.com';

-- 3. Verificar se há algum bloqueio ou problema
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.banned_until,
    p.active,
    p.is_active,
    p.role
FROM auth.users u
LEFT JOIN sistemaretiradas.profiles p ON u.id = p.id
WHERE u.email = 'gabrieleferreirabobato@gmail.com';

-- ============================================================================
-- SE O USUÁRIO EXISTIR MAS NÃO CONSEGUIR LOGAR, EXECUTE:
-- ============================================================================

-- 4. Confirmar email (se não estiver confirmado)
UPDATE auth.users
SET 
    email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'gabrieleferreirabobato@gmail.com'
AND email_confirmed_at IS NULL;

-- 5. Ativar profile (se estiver inativo)
UPDATE sistemaretiradas.profiles
SET 
    active = true,
    is_active = true
WHERE email = 'gabrieleferreirabobato@gmail.com';

-- 6. Remover qualquer banimento
UPDATE auth.users
SET banned_until = NULL
WHERE email = 'gabrieleferreirabobato@gmail.com'
AND banned_until IS NOT NULL;

-- ============================================================================
-- RESETAR SENHA DIRETAMENTE (ÚLTIMO RECURSO)
-- ============================================================================

-- 7. Buscar o user_id primeiro
SELECT id FROM auth.users WHERE email = 'gabrieleferreirabobato@gmail.com';

-- 8. COPIE O ID ACIMA E EXECUTE VIA NETLIFY FUNCTION
-- Não é possível resetar senha diretamente via SQL por segurança
-- Use a função reset-colaboradora-password via Admin Dashboard
