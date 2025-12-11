-- =====================================================
-- CRIAR CRON JOB PARA PROCESSAR FILA DE NOTIFICAÇÕES DE PONTO
-- =====================================================
-- Processa a fila de notificações de controle de ponto a cada minuto

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE NOTICE '⚠️ pg_cron não está habilitado. Habilite em: Supabase Dashboard > Database > Extensions';
        RAISE NOTICE '   Depois execute esta migration novamente.';
    END IF;
END $$;

-- Remover job existente se houver
SELECT cron.unschedule('process-time-clock-notifications') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
);

-- NOTA: O cron job deve ser configurado manualmente no Supabase Dashboard
-- para chamar a Edge Function diretamente:
-- 
-- URL: https://[seu-projeto].supabase.co/functions/v1/process-time-clock-notifications
-- Método: POST
-- Headers: 
--   Authorization: Bearer [SERVICE_ROLE_KEY]
--   Content-Type: application/json
-- Schedule: * * * * * (a cada minuto)
--
-- O job SQL abaixo é mantido apenas para referência, mas não será usado
-- SELECT cron.schedule(
--     'process-time-clock-notifications',  -- Nome do job
--     '* * * * *',                         -- A cada minuto (cron expression)
--     $$
--     SELECT sistemaretiradas.process_time_clock_notification_queue();
--     $$
-- );

COMMENT ON FUNCTION sistemaretiradas.process_time_clock_notification_queue() IS 'Agendado para executar a cada 1 minuto via pg_cron para processar notificações de ponto';

