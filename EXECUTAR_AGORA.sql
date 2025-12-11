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

-- 4. Criar novo cron job com header de autenticação
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM cron.schedule(
            'process-time-clock-notifications',
            '* * * * *',  -- A cada minuto
            $$
            SELECT
                net.http_post(
                    url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', (SELECT value FROM sistemaretiradas.app_config WHERE key = 'supabase_anon_key' LIMIT 1)
                    ),
                    body := '{}'::jsonb
                ) AS request_id;
            $$
        );
        RAISE NOTICE '✅ Cron job atualizado com header de autenticação';
    ELSE
        RAISE WARNING '⚠️ pg_net não está habilitado';
    END IF;
END $$;

-- 5. Verificar se o cron job foi criado corretamente
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 200) as command_preview
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 6. Verificar itens pendentes na fila
SELECT 
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.time_clock_notification_queue;

-- Pronto! Aguarde 1-2 minutos e verifique se os itens estão sendo processados

