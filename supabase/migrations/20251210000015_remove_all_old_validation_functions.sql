-- =====================================================
-- REMOVER TODAS AS FUNÇÕES DE VALIDAÇÃO ANTIGAS
-- =====================================================
-- Esta migração garante que não há funções antigas
-- que validam limite total em vez de por dia
-- 
-- IMPORTANTE: Esta migração deve ser executada ANTES da
-- migração 20251210000014 que recria as funções corretas

-- Remover todas as funções e triggers relacionados a validação de limite
DROP TRIGGER IF EXISTS trigger_validate_store_notification_limit_after_recipient_change ON sistemaretiradas.store_notification_recipients;
DROP TRIGGER IF EXISTS trigger_validate_store_notification_limit ON sistemaretiradas.store_notifications;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_store_notification_limit_after_recipient_change() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_store_notification_limit() CASCADE;

-- Verificar se há outras funções com nomes similares que possam ter sido criadas manualmente
DO $$
DECLARE
    func_name TEXT;
BEGIN
    -- Listar e remover todas as funções que contenham "validate" e "notification" e "limit" no nome
    FOR func_name IN
        SELECT proname || '(' || pg_get_function_arguments(oid) || ')' as func_sig
        FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
        AND proname LIKE '%validate%'
        AND proname LIKE '%notification%'
        AND proname LIKE '%limit%'
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS sistemaretiradas.' || func_name || ' CASCADE';
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignorar erros se a função não existir ou tiver dependências
                NULL;
        END;
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignorar erros se não houver funções para remover
        NULL;
END $$;

