-- =====================================================
-- TESTAR EDGE FUNCTION MANUALMENTE
-- =====================================================

-- 1. Verificar se há itens pendentes
SELECT 
    COUNT(*) as pending_count
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING';

-- 2. Testar chamada manual da Edge Function via pg_net
-- (Isso simula o que o cron job faz)
SELECT
    net.http_post(
        url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) AS request_id;

-- 3. Aguardar alguns segundos e verificar se itens foram processados
-- (Execute este SELECT após alguns segundos)
SELECT 
    id,
    phone,
    status,
    attempts,
    error_message,
    created_at,
    sent_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status IN ('PENDING', 'SENT', 'FAILED')
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar logs do cron job (últimas execuções)
SELECT 
    runid,
    jobid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-time-clock-notifications')
ORDER BY start_time DESC
LIMIT 5;

