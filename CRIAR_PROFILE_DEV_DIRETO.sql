-- =============================================================================
-- SQL DIRETO: Criar Profile para dev@dev.com
-- =============================================================================
-- Execute este SQL no Supabase SQL Editor
-- O usuário dev@dev.com já deve existir no auth.users
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Buscar ID do usuário dev@dev.com
DO $$
DECLARE
    v_user_id UUID;
    v_profile_exists BOOLEAN;
BEGIN
    -- Buscar ID do usuário
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'dev@dev.com'
    LIMIT 1;

    -- Verificar se encontrou usuário
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário dev@dev.com não encontrado no auth.users. Crie o usuário primeiro no Supabase Dashboard → Authentication → Users';
    END IF;

    RAISE NOTICE 'Usuário encontrado: %', v_user_id;

    -- Verificar se profile já existe
    SELECT EXISTS(
        SELECT 1 FROM profiles
        WHERE id = v_user_id
    ) INTO v_profile_exists;

    -- Se não existe, criar
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

        RAISE NOTICE '✅ Profile criado com sucesso para dev@dev.com!';
    ELSE
        -- Atualizar para garantir que é ADMIN
        UPDATE profiles
        SET 
            name = 'Desenvolvedor',
            role = 'ADMIN',
            active = true,
            updated_at = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE '✅ Profile já existe. Atualizado para ADMIN.';
    END IF;
END;
$$;

-- Verificar resultado
SELECT 
    u.email,
    u.email_confirmed_at,
    p.name,
    p.role,
    p.active
FROM auth.users u
LEFT JOIN sistemaretiradas.profiles p ON p.id = u.id
WHERE u.email = 'dev@dev.com';

