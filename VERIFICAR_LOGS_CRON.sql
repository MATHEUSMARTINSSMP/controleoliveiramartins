-- =====================================================
-- VERIFICAR LOGS DO CRON JOB
-- =====================================================

-- Verificar últimas execuções do cron job
SELECT 
    runid,
    jobid,
    job_pid,
    status,
    return_message,
    start_time,
    end_time,
    CASE 
        WHEN end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (end_time - start_time))
        ELSE NULL
    END as duration_seconds,
    command
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-time-clock-notifications')
ORDER BY start_time DESC
LIMIT 10;

-- Verificar status atual do cron job
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    nodename,
    nodeport
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- Contar execuções por status
SELECT 
    status,
    COUNT(*) as count,
    MAX(start_time) as last_execution
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-time-clock-notifications')
GROUP BY status
ORDER BY count DESC;

