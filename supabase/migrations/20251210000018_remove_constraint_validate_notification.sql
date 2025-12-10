-- =====================================================
-- REMOVER CONSTRAINT QUE CHAMA FUNÇÃO INEXISTENTE
-- =====================================================
-- O erro indica que há uma constraint ou trigger tentando
-- chamar validate_notification_limit(uuid, time[], integer[])
-- que não existe. Esta migração remove qualquer constraint
-- ou trigger que possa estar fazendo essa chamada.

-- Remover qualquer constraint CHECK que possa estar chamando a função
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Listar todas as constraints CHECK na tabela store_notifications
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'sistemaretiradas.store_notifications'::regclass
        AND contype = 'c'  -- CHECK constraint
        AND pg_get_constraintdef(oid) LIKE '%validate%notification%limit%'
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE sistemaretiradas.store_notifications DROP CONSTRAINT IF EXISTS ' || constraint_name || ' CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignorar erros se a constraint não existir
                NULL;
        END;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignorar erros se não houver constraints para remover
        NULL;
END $$;

-- Garantir que a função validate_notification_limit não existe
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, time without time zone[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit CASCADE;

