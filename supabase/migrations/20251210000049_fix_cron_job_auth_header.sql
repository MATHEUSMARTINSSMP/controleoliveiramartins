-- =====================================================
-- CORRIGIR CRON JOB: ADICIONAR HEADER DE AUTENTICAÇÃO
-- =====================================================
-- O problema: Edge Function está retornando 401 porque o cron job
-- não está enviando header de autenticação (apikey)
-- 
-- Solução: Adicionar header 'apikey' com a chave anônima do Supabase
-- A chave será buscada da tabela app_config (configure usando CONFIGURAR_CHAVE_ANONIMA.sql)

DO $$
BEGIN
    -- Remover cron job antigo
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
        RAISE NOTICE '✅ Cron job antigo removido';
    END IF;

    -- Verificar se pg_net está disponível
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        -- Criar novo cron job com header de autenticação
        -- A chave anônima será buscada da tabela app_config
        PERFORM cron.schedule(
            'process-time-clock-notifications',
            '* * * * *',  -- A cada minuto
            $cron$
            SELECT
                net.http_post(
                    url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', (SELECT value FROM sistemaretiradas.app_config WHERE key = 'supabase_anon_key' LIMIT 1)
                    ),
                    body := '{}'::jsonb
                ) AS request_id;
            $cron$
        );
        
        RAISE NOTICE '✅ Cron job atualizado com header de autenticação';
        RAISE NOTICE '⚠️ Lembrete: Execute CONFIGURAR_CHAVE_ANONIMA.sql para adicionar a chave na tabela app_config';
    ELSE
        RAISE WARNING '⚠️ pg_net não está habilitado';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Erro ao atualizar cron job: %', SQLERRM;
END $$;

