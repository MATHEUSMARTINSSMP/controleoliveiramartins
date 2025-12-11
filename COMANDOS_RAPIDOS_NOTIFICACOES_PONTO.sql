-- =====================================================
-- COMANDOS RÁPIDOS: Notificações de Ponto
-- =====================================================
-- Cole estes comandos no SQL Editor do Supabase para configurar tudo

-- =====================================================
-- 1. VERIFICAR SE pg_net ESTÁ HABILITADO (OBRIGATÓRIO)
-- =====================================================
-- Execute primeiro se não estiver habilitado:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
        THEN '✅ pg_net está habilitado'
        ELSE '❌ pg_net NÃO está habilitado - Execute: CREATE EXTENSION IF NOT EXISTS pg_net;'
    END as status_pg_net;

-- =====================================================
-- 2. CONFIGURAR CRON JOB (CHAMA EDGE FUNCTION)
-- =====================================================
-- Remover job antigo se existir e criar novo
DO $$
BEGIN
    -- Remover job antigo se existir
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
        RAISE NOTICE '✅ Cron job antigo removido';
    END IF;
    
    -- Verificar se pg_net está habilitado
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        -- Criar novo job que chama a Edge Function via HTTP
        PERFORM cron.schedule(
            'process-time-clock-notifications',
            '* * * * *',  -- A cada minuto
            $cron$
            SELECT
                net.http_post(
                    url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json'
                    ),
                    body := '{}'::jsonb
                ) AS request_id;
            $cron$
        );
        RAISE NOTICE '✅ Cron job criado com sucesso';
    ELSE
        RAISE EXCEPTION '❌ pg_net não está habilitado. Execute primeiro: CREATE EXTENSION IF NOT EXISTS pg_net;';
    END IF;
END $$;

-- =====================================================
-- 3. VERIFICAR SE O JOB FOI CRIADO
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
-- 4. REATIVAR NOTIFICAÇÕES FALHADAS (ERRO ANTIGO)
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
-- 5. VERIFICAR NOTIFICAÇÕES PENDENTES
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
-- 6. VERIFICAR CONFIGURAÇÕES DE NOTIFICAÇÃO ATIVAS
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
-- 7. ESTATÍSTICAS DAS NOTIFICAÇÕES (ÚLTIMAS 24H)
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
-- 8. VER ÚLTIMAS EXECUÇÕES DO CRON JOB
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
-- 9. HABILITAR pg_net (SE NECESSÁRIO)
-- =====================================================
-- Execute apenas se o passo 1 mostrar que pg_net não está habilitado:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

