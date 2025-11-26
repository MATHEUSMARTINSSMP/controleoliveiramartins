-- =============================================================================
-- AGENDAR SINCRONIZAÇÃO AUTOMÁTICA TINY ERP
-- =============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Substitua 'kktsbnrnlnzyofupegjc' pela URL do seu projeto Supabase
--    (encontre em: Project Settings → API → Project URL)
-- 2. Execute este SQL no SQL Editor do Supabase
-- 3. Verifique se pg_cron está habilitado (Database → Extensions)
-- 4. Verifique se a extensão 'http' está habilitada (necessária para net.http_post)
--
-- =============================================================================

-- Remover agendamento anterior (se existir)
SELECT cron.unschedule('sync-tiny-orders-automatic');

-- Agendar nova sincronização (a cada 30 minutos)
SELECT cron.schedule(
    'sync-tiny-orders-automatic',
    '*/30 * * * *', -- A cada 30 minutos (formato cron)
    $$
    SELECT net.http_post(
        url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        )::jsonb,
        body := '{}'::jsonb
    ) AS request_id;
    $$
);

-- =============================================================================
-- VERIFICAR SE FOI AGENDADO CORRETAMENTE
-- =============================================================================

SELECT 
    jobid,
    jobname,
    schedule,
    active,
    database,
    username
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatic';

-- =============================================================================
-- FIM
-- =============================================================================

