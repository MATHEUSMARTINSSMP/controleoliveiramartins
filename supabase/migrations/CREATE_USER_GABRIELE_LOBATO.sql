-- ============================================================================
-- CRIAR USUÁRIO AUTH PARA GABRIELE LOBATO DE FREITAS
-- Execute este script no SQL Editor do Supabase
-- ============================================================================

-- Dados da colaboradora existente no profile
-- ID: 7ce67086-8683-4423-b486-179ea2ac1ce0
-- Nome: Gabriele Lobato de Freitas
-- Email: gabrielefreitaslobato@gmail.com
-- CPF: 09566505205
-- WhatsApp: 96981072792
-- Loja: Mr. Kitsch

-- IMPORTANTE: Este script usa a Admin API do Supabase
-- Você precisa executar via código Node.js ou usar o Dashboard do Supabase

-- ============================================================================
-- OPÇÃO 1: Via Dashboard do Supabase (RECOMENDADO)
-- ============================================================================
-- 1. Acesse: https://kktsbnrnlnzyofupegjc.supabase.co/project/kktsbnrnlnzyofupegjc/auth/users
-- 2. Clique em "Add user" > "Create new user"
-- 3. Preencha:
--    - Email: gabrielefreitaslobato@gmail.com
--    - Password: 123456
--    - Auto Confirm User: ✅ SIM (marque esta opção)
-- 4. Clique em "Create user"
-- 5. IMPORTANTE: Copie o UUID gerado
-- 6. Execute o SQL abaixo substituindo NEW_USER_ID pelo UUID copiado:

/*
-- Deletar profile antigo
DELETE FROM sistemaretiradas.profiles 
WHERE id = '7ce67086-8683-4423-b486-179ea2ac1ce0';

-- Criar novo profile com o ID correto do Auth
INSERT INTO sistemaretiradas.profiles (
    id,
    name,
    email,
    role,
    cpf,
    store_default,
    store_id,
    whatsapp,
    limite_total,
    limite_mensal,
    is_active,
    recebe_notificacoes_gincana
) VALUES (
    'COLE_O_UUID_AQUI', -- Substitua pelo UUID do usuário criado
    'Gabriele Lobato de Freitas',
    'gabrielefreitaslobato@gmail.com',
    'COLABORADORA',
    '09566505205',
    'Mr. Kitsch',
    'c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3',
    '96981072792',
    1000,
    800,
    true,
    true
);
*/

-- ============================================================================
-- OPÇÃO 2: Via Script Node.js (AUTOMÁTICO)
-- ============================================================================
-- Execute o comando abaixo no terminal:
-- node scripts/create-auth-user-gabriele-lobato.mjs

-- O script está pronto e vai:
-- 1. Criar usuário no Auth
-- 2. Deletar profile antigo
-- 3. Criar novo profile com ID correto
-- 4. Exibir as credenciais de login
