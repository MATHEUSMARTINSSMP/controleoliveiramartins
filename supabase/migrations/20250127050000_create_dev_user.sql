-- =============================================================================
-- CRIAR USUÁRIO DEV PARA ACESSO AO PAINEL DEV
-- =============================================================================
-- Usuário: dev@dev.com
-- Senha: 123456
-- Role: ADMIN (acesso total)
-- =============================================================================
-- 
-- IMPORTANTE: Esta migration precisa ser executada com Service Role Key
-- ou criar o usuário manualmente no Supabase Dashboard
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. FUNÇÃO PARA CRIAR USUÁRIO DEV (executa apenas se não existir)
-- =============================================================================
-- Esta função será chamada manualmente ou via Edge Function
-- Não pode criar usuário diretamente no auth.users via SQL normal

-- Função auxiliar para verificar/criar profile do dev
CREATE OR REPLACE FUNCTION create_dev_user_profile()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_user_id UUID;
    v_profile_exists BOOLEAN;
BEGIN
    -- Buscar ID do usuário dev@dev.com no auth.users
    -- NOTA: Precisa de acesso ao schema auth (apenas Service Role)
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'dev@dev.com'
    LIMIT 1;

    -- Se não encontrou usuário, retornar instruções
    IF v_user_id IS NULL THEN
        RETURN 'ERRO: Usuário dev@dev.com não encontrado no auth.users. '
               'Crie o usuário manualmente no Supabase Dashboard → Authentication → Users '
               'com email: dev@dev.com e senha: 123456, depois execute esta função novamente.';
    END IF;

    -- Verificar se profile já existe
    SELECT EXISTS(
        SELECT 1 FROM profiles
        WHERE id = v_user_id
    ) INTO v_profile_exists;

    -- Se não existe profile, criar
    IF NOT v_profile_exists THEN
        INSERT INTO profiles (
            id,
            name,
            email,
            role,
            active,
            limite_total,
            limite_mensal,
            created_at,
            updated_at
        )
        VALUES (
            v_user_id,
            'Desenvolvedor',
            'dev@dev.com',
            'ADMIN',
            true,
            999999.00,
            999999.00,
            NOW(),
            NOW()
        );

        RETURN 'SUCCESS: Profile criado para dev@dev.com (ID: ' || v_user_id || ')';
    ELSE
        -- Atualizar para garantir que é ADMIN e ativo
        UPDATE profiles
        SET 
            role = 'ADMIN',
            active = true,
            updated_at = NOW()
        WHERE id = v_user_id;

        RETURN 'SUCCESS: Profile já existe para dev@dev.com (ID: ' || v_user_id || '). Atualizado para ADMIN.';
    END IF;
END;
$$;

COMMENT ON FUNCTION create_dev_user_profile() IS 'Cria ou atualiza profile do usuário dev@dev.com. Execute após criar usuário no auth.users';

-- =============================================================================
-- 2. INSTRUÇÕES PARA CRIAR USUÁRIO MANUALMENTE
-- =============================================================================
-- 
-- OPÇÃO 1: Via Supabase Dashboard (RECOMENDADO)
-- ----------------------------------------------
-- 1. Acesse: Supabase Dashboard → Authentication → Users
-- 2. Clique em "Add user" → "Create new user"
-- 3. Preencha:
--    - Email: dev@dev.com
--    - Password: 123456
--    - Auto Confirm User: ✅ Sim
-- 4. Clique em "Create user"
-- 5. Execute a função: SELECT create_dev_user_profile();
--
-- OPÇÃO 2: Via SQL (requer Service Role)
-- ---------------------------------------
-- Execute no SQL Editor com Service Role Key:
--
-- SELECT create_dev_user_profile();
--
-- =============================================================================

-- =============================================================================
-- 3. VERIFICAÇÃO (executa automaticamente se usuário existir)
-- =============================================================================
-- Tenta criar profile se usuário já existir
DO $$
DECLARE
    v_user_id UUID;
    v_result TEXT;
BEGIN
    -- Verificar se usuário existe
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'dev@dev.com'
    LIMIT 1;

    -- Se existe, criar profile
    IF v_user_id IS NOT NULL THEN
        SELECT create_dev_user_profile() INTO v_result;
        RAISE NOTICE '%', v_result;
    ELSE
        RAISE NOTICE 'Usuário dev@dev.com não encontrado. Crie manualmente no Supabase Dashboard.';
    END IF;
END;
$$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
