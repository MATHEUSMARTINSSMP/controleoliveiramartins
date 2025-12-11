-- =====================================================
-- EXECUTAR AGORA V2: Usar Service Role Key no Header Authorization
-- =====================================================
-- Tentativa alternativa: usar Authorization Bearer ao invés de apikey
-- Isso pode funcionar melhor mesmo com verify_jwt = false

-- 1. Configurar service role key na tabela app_config
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- 2. Configurar chave anônima também (caso precise)
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_anon_key', 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- 3. Verificar configurações
SELECT 
    key,
    CASE 
        WHEN value IS NULL THEN '❌ NÃO CONFIGURADO'
        WHEN LENGTH(value) < 50 THEN '⚠️ VALOR SUSPEITO'
        ELSE '✅ CONFIGURADO'
    END as status,
    LENGTH(value) as key_length
FROM sistemaretiradas.app_config
WHERE key IN ('supabase_service_role_key', 'supabase_anon_key')
ORDER BY key;

-- 4. Remover cron job antigo
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
        RAISE NOTICE '✅ Cron job antigo removido';
    END IF;
END $$;

-- 5. Criar novo cron job com Authorization Bearer
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM cron.schedule(
            'process-time-clock-notifications',
            '* * * * *',
            $cron$
            SELECT
                net.http_post(
                    url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', (SELECT value FROM sistemaretiradas.app_config WHERE key = 'supabase_anon_key' LIMIT 1),
                        'Authorization', 'Bearer ' || (SELECT value FROM sistemaretiradas.app_config WHERE key = 'supabase_service_role_key' LIMIT 1)
                    ),
                    body := '{}'::jsonb
                ) AS request_id;
            $cron$
        );
        RAISE NOTICE '✅ Cron job atualizado com apikey + Authorization Bearer';
    ELSE
        RAISE WARNING '⚠️ pg_net não está habilitado';
    END IF;
END $$;

-- 6. Verificar cron job
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 7. Verificar itens pendentes
SELECT 
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.time_clock_notification_queue;

