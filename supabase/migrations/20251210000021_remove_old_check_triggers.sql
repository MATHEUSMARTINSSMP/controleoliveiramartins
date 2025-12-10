-- =====================================================
-- REMOVER TRIGGERS E FUNÇÕES ANTIGAS QUE CHAMAM FUNÇÕES INEXISTENTES
-- =====================================================
-- PROBLEMA ENCONTRADO:
-- As funções check_notification_limit_insert e check_notification_limit_update
-- estão chamando sistemaretiradas.validate_notification_limit() que NÃO EXISTE
-- 
-- Essas funções antigas usam uma validação TOTAL (não por dia), que está incorreta
-- Devem ser removidas e substituídas pelas novas funções que validam POR DIA

-- PASSO 1: Remover triggers antigos
DROP TRIGGER IF EXISTS check_notification_limit_insert ON sistemaretiradas.store_notifications CASCADE;
DROP TRIGGER IF EXISTS check_notification_limit_update ON sistemaretiradas.store_notifications CASCADE;

-- PASSO 2: Remover as funções que chamam validate_notification_limit inexistente
DROP FUNCTION IF EXISTS sistemaretiradas.check_notification_limit_insert() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.check_notification_limit_update() CASCADE;

-- PASSO 3: Remover funções auxiliares que essas funções antigas podem estar usando
-- (essas funções provavelmente também não existem, mas vamos garantir)
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, text[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.validate_notification_limit(uuid, text[], integer[], uuid) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.get_available_notification_messages(uuid) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.get_available_notification_messages(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.calculate_notification_messages(text[], integer[]) CASCADE;

-- PASSO 4: check_store_notifications_dias_semana pode ficar se não estiver causando problemas
-- Mas vamos verificar se validate_dias_semana existe
-- Se não existir, vamos remover esse trigger também
DO $$
BEGIN
    -- Verificar se validate_dias_semana existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
        AND proname = 'validate_dias_semana'
    ) THEN
        -- Se não existir, remover o trigger que depende dela
        DROP TRIGGER IF EXISTS check_store_notifications_dias_semana ON sistemaretiradas.store_notifications CASCADE;
        DROP FUNCTION IF EXISTS sistemaretiradas.check_store_notifications_dias_semana() CASCADE;
        RAISE NOTICE 'Removido trigger check_store_notifications_dias_semana (função validate_dias_semana não existe)';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao verificar validate_dias_semana: %', SQLERRM;
END $$;

COMMENT ON TRIGGER trigger_validate_store_notification_limit ON sistemaretiradas.store_notifications IS 'Trigger correto para validação de limite por dia da semana (substitui triggers antigos)';

