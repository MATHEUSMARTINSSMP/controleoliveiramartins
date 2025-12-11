-- =====================================================
-- COMANDOS RÁPIDOS: Notificações de Ponto
-- =====================================================
-- Cole estes comandos no SQL Editor do Supabase para configurar tudo

-- =====================================================
-- 1. CONFIGURAR CRON JOB (CHAMA EDGE FUNCTION)
-- =====================================================
-- Remover job antigo se existir
SELECT cron.unschedule('process-time-clock-notifications') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
);

-- Criar novo job que chama a Edge Function via HTTP
SELECT cron.schedule(
    'process-time-clock-notifications',
    '* * * * *',  -- A cada minuto
    $$
    SELECT
        net.http_post(
            url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s'
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);

-- =====================================================
-- 2. VERIFICAR SE O JOB FOI CRIADO
-- =====================================================
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- =====================================================
-- 3. REATIVAR NOTIFICAÇÕES FALHADAS (ERRO ANTIGO)
-- =====================================================
UPDATE sistemaretiradas.time_clock_notification_queue
SET status = 'PENDING',
    error_message = NULL,
    attempts = 0
WHERE status = 'FAILED'
AND error_message LIKE '%column "content" does not exist%'
AND attempts < 3;

-- Verificar quantas foram reativadas
SELECT COUNT(*) as reativadas
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING';

-- =====================================================
-- 4. VERIFICAR NOTIFICAÇÕES PENDENTES
-- =====================================================
SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10;

-- =====================================================
-- 5. VERIFICAR CONFIGURAÇÕES DE NOTIFICAÇÃO ATIVAS
-- =====================================================
SELECT 
    wnc.id,
    wnc.admin_id,
    wnc.store_id,
    wnc.phone,
    wnc.active,
    wnc.notification_type,
    s.name as store_name,
    p.email as admin_email
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = wnc.admin_id
WHERE wnc.notification_type = 'CONTROLE_PONTO'
AND wnc.active = true
ORDER BY wnc.created_at DESC;

-- =====================================================
-- 6. ESTATÍSTICAS DAS NOTIFICAÇÕES (ÚLTIMAS 24H)
-- =====================================================
SELECT 
    status,
    COUNT(*) as total,
    MIN(created_at) as primeira,
    MAX(created_at) as ultima
FROM sistemaretiradas.time_clock_notification_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;

-- =====================================================
-- 7. VER ÚLTIMAS EXECUÇÕES DO CRON JOB
-- =====================================================
SELECT 
    runid,
    jobid,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
WHERE jobid IN (
    SELECT jobid FROM cron.job WHERE jobname = 'process-time-clock-notifications'
)
ORDER BY start_time DESC
LIMIT 10;

-- =====================================================
-- 8. VERIFICAR SE pg_net ESTÁ HABILITADO
-- =====================================================
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Se não estiver habilitado, execute:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

