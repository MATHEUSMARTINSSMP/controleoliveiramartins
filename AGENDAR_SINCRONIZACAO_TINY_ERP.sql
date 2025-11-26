-- =============================================================================
-- AGENDAR SINCRONIZAÇÃO AUTOMÁTICA TINY ERP
-- =============================================================================
-- 
-- ✅ PRONTO PARA COPIAR E COLAR!
-- 
-- INSTRUÇÕES:
-- 1. Execute este SQL no SQL Editor do Supabase
-- 2. Verifique se pg_cron está habilitado (Database → Extensions)
-- 3. Verifique se a extensão 'http' está habilitada (necessária para net.http_post)
-- 4. Se a URL do seu projeto for diferente, substitua 'kktsbnrnlnzyofupegjc'
--    (encontre em: Project Settings → API → Project URL)
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

