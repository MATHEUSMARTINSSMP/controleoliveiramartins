-- =====================================================
-- EXECUTAR AGORA: Configurar Chave Anônima e Atualizar Cron Job
-- =====================================================
-- Copie e cole tudo isso no Supabase SQL Editor

-- 1. Configurar chave anônima na tabela app_config
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_anon_key', 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- 2. Verificar se foi configurado corretamente
SELECT 
    key,
    CASE 
        WHEN value IS NULL THEN '❌ NÃO CONFIGURADO'
        WHEN LENGTH(value) < 50 THEN '⚠️ VALOR SUSPEITO (muito curto)'
        ELSE '✅ CONFIGURADO'
    END as status,
    LENGTH(value) as key_length,
    LEFT(value, 30) || '...' as preview
FROM sistemaretiradas.app_config
WHERE key = 'supabase_anon_key';

-- 3. Remover cron job antigo
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
        RAISE NOTICE '✅ Cron job antigo removido';
    END IF;
END $$;

-- 4. Configurar service role key também
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- 5. Criar novo cron job com headers de autenticação (apikey + Authorization)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM cron.schedule(
            'process-time-clock-notifications',
            '* * * * *',  -- A cada minuto
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

-- 6. Verificar se o cron job foi criado corretamente
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 200) as command_preview
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 7. Verificar itens pendentes na fila
SELECT 
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.time_clock_notification_queue;

-- Pronto! Aguarde 1-2 minutos e verifique se os itens estão sendo processados

