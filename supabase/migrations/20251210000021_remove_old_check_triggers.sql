-- =====================================================
-- REMOVER TRIGGERS ANTIGOS QUE CHAMAM FUNÇÕES INEXISTENTES
-- =====================================================
-- Encontrados triggers que chamam funções que não existem:
-- - check_notification_limit_insert
-- - check_notification_limit_update
-- Esses triggers estão causando o erro

-- Remover triggers antigos
DROP TRIGGER IF EXISTS check_notification_limit_insert ON sistemaretiradas.store_notifications CASCADE;
DROP TRIGGER IF EXISTS check_notification_limit_update ON sistemaretiradas.store_notifications CASCADE;

-- Remover as funções se existirem (provavelmente não existem, mas vamos garantir)
DROP FUNCTION IF EXISTS sistemaretiradas.check_notification_limit_insert() CASCADE;
DROP FUNCTION IF EXISTS sistemaretiradas.check_notification_limit_update() CASCADE;

-- Verificar se check_store_notifications_dias_semana existe e é necessária
-- Se não for necessária, também pode ser removida
-- Por enquanto, vamos deixá-la se existir

COMMENT ON TRIGGER trigger_validate_store_notification_limit ON sistemaretiradas.store_notifications IS 'Trigger correto para validação de limite por dia da semana';

