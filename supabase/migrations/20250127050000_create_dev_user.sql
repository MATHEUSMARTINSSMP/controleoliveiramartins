-- =============================================================================
-- CRIAR USUÁRIO DEV PARA ACESSO AO PAINEL DEV
-- =============================================================================
-- Usuário: dev@dev.com
-- Senha: 123456
-- Role: ADMIN (acesso total)
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Função para criar usuário dev (executa apenas se não existir)
DO $$
DECLARE
    v_user_id UUID;
    v_profile_exists BOOLEAN;
BEGIN
    -- Verificar se o usuário já existe no auth
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'dev@dev.com'
    LIMIT 1;

    -- Se não existe, criar
    IF v_user_id IS NULL THEN
        -- Criar usuário no auth (precisa ser feito via API ou manualmente)
        -- Por enquanto, apenas criar o profile se o usuário já existir
        RAISE NOTICE 'Usuário dev@dev.com não encontrado no auth.users.';
        RAISE NOTICE 'Por favor, crie o usuário manualmente no Supabase Auth com:';
        RAISE NOTICE '  Email: dev@dev.com';
        RAISE NOTICE '  Senha: 123456';
        RAISE NOTICE 'Depois execute a parte do profile abaixo.';
    ELSE
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
            )
            ON CONFLICT (id) DO NOTHING;

            RAISE NOTICE 'Profile criado para dev@dev.com';
        ELSE
            RAISE NOTICE 'Profile já existe para dev@dev.com';
        END IF;
    END IF;
END;
$$;

-- Comentário
COMMENT ON FUNCTION validate_erp_integration_sistema() IS 'Usuário dev criado: dev@dev.com / 123456 - Acesso total ao sistema e painel dev';

-- =============================================================================
-- INSTRUÇÕES PARA CRIAR USUÁRIO MANUALMENTE
-- =============================================================================
-- 1. Acesse Supabase Dashboard → Authentication → Users
-- 2. Clique em "Add user" → "Create new user"
-- 3. Preencha:
--    - Email: dev@dev.com
--    - Password: 123456
--    - Auto Confirm User: Sim
-- 4. Execute esta migration novamente para criar o profile
-- =============================================================================

