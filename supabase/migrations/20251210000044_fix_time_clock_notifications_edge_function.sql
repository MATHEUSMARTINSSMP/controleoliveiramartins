-- =====================================================
-- CORRIGIR NOTIFICAÇÕES DE PONTO - USAR EDGE FUNCTION
-- =====================================================
-- Substitui o processamento via pg_net por Edge Function do Supabase
-- que chama diretamente a Netlify Function, muito mais confiável

-- 1. Remover a função SQL problemática que usa pg_net
DROP FUNCTION IF EXISTS sistemaretiradas.process_time_clock_notification_queue() CASCADE;

-- 2. Remover cron job antigo se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
        RAISE NOTICE '✅ Cron job antigo removido';
    ELSE
        RAISE NOTICE 'ℹ️ Nenhum cron job antigo encontrado';
    END IF;
END $$;

-- 3. Criar novo cron job que chama a Edge Function diretamente via pg_net
-- NOTA: Requer que a extensão pg_net esteja habilitada
DO $$
BEGIN
    -- Verificar se pg_net está disponível
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        -- Criar cron job que chama a Edge Function
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
        RAISE NOTICE '✅ Cron job criado com sucesso para chamar Edge Function';
    ELSE
        RAISE WARNING '⚠️ pg_net não está habilitado. Habilite em: Supabase Dashboard > Database > Extensions';
        RAISE WARNING '⚠️ Depois execute: CREATE EXTENSION IF NOT EXISTS pg_net;';
        RAISE WARNING '⚠️ E então execute novamente esta migration ou configure o cron job manualmente';
    END IF;
END $$;

-- 4. Reativar itens falhados que tiveram erro de "column content does not exist"
-- (esses foram falhas do pg_net antigo, podem ser reprocessados)
UPDATE sistemaretiradas.time_clock_notification_queue
SET status = 'PENDING',
    error_message = NULL,
    attempts = 0
WHERE status = 'FAILED'
AND error_message LIKE '%column "content" does not exist%'
AND attempts < 3;

-- 5. Comentários
COMMENT ON TABLE sistemaretiradas.time_clock_notification_queue IS 
'Fila de notificações de controle de ponto aguardando envio via WhatsApp. Processada pela Edge Function process-time-clock-notifications.';

