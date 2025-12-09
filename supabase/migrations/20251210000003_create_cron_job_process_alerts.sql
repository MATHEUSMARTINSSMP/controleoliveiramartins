-- =====================================================
-- CRON JOB PARA PROCESSAR ALERTAS AUTOMATICAMENTE
-- =====================================================

-- NOTA: Esta migration requer que pg_cron esteja habilitado
-- Para habilitar: Supabase Dashboard > Database > Extensions > Enable pg_cron

-- Verificar se pg_cron está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE NOTICE '⚠️ pg_cron não está habilitado. Habilite em: Supabase Dashboard > Database > Extensions';
    END IF;
END $$;

-- Função para chamar a Netlify Function que processa a fila
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_processar_alertas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_netlify_url TEXT;
    v_response_status INTEGER;
    v_response_body TEXT;
    v_request_id BIGINT;
BEGIN
    -- URL da Netlify Function
    v_netlify_url := 'https://eleveaone.com.br/.netlify/functions/process-store-task-alerts';
    
    -- Primeiro, chamar a função RPC para identificar alertas e inserir na fila
    PERFORM sistemaretiradas.process_store_task_alerts();
    
    -- Tentar usar pg_net para chamar a Netlify Function
    BEGIN
        SELECT net.http_post(
            url := v_netlify_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json'
            ),
            body := '{}'::jsonb
        ) INTO v_request_id;
        
        RAISE NOTICE '[pg_cron] Processamento de alertas iniciado via pg_net. Request ID: %', v_request_id;
    EXCEPTION WHEN OTHERS THEN
        -- Se pg_net não estiver disponível, tentar http extension
        BEGIN
            PERFORM http_post(
                v_netlify_url,
                '{}'::json,
                'application/json'
            );
            RAISE NOTICE '[pg_cron] Processamento de alertas chamado via http extension';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[pg_cron] Nenhuma extensão HTTP disponível (pg_net ou http). Configure uma delas no Supabase. Erro: %', SQLERRM;
        END;
    END;
END;
$$;

-- Criar job no pg_cron para executar a cada minuto
-- NOTA: Se pg_cron não estiver disponível, este comando falhará silenciosamente
DO $$
BEGIN
    -- Remover job existente se houver
    PERFORM cron.unschedule('process-store-task-alerts');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar erro se job não existir
    NULL;
END $$;

-- Criar novo job
SELECT cron.schedule(
    'process-store-task-alerts',
    '* * * * *', -- A cada minuto
    $$SELECT sistemaretiradas.chamar_processar_alertas()$$
);

-- Criar job para resetar contador diário à meia-noite
DO $$
BEGIN
    PERFORM cron.unschedule('reset-daily-sends');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'reset-daily-sends',
    '0 0 * * *', -- À meia-noite todos os dias
    $$SELECT sistemaretiradas.reset_daily_sends()$$
);

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.chamar_processar_alertas() IS 'Chama Netlify Function para processar fila de alertas. Executada via pg_cron a cada 1 minuto.';

-- IMPORTANTE: pg_cron precisa estar habilitado
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- NOTA: Se pg_cron não estiver disponível, usar alternativa abaixo:
-- 1. Configurar webhook no Netlify para chamar a função periodicamente
-- 2. Usar serviço externo (cron-job.org, EasyCron, etc.) para chamar a URL:
--    https://eleveaone.com.br/.netlify/functions/process-store-task-alerts
--    a cada 1 minuto

