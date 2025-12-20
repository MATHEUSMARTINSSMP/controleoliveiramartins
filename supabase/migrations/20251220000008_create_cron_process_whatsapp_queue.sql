-- =====================================================
-- CRON JOB: Processar Fila Unificada de WhatsApp
-- =====================================================
-- Este migration cria um cron job para processar
-- automaticamente a fila unificada de WhatsApp (whatsapp_message_queue)
-- 
-- IMPORTANTE: Requer pg_cron habilitado
-- Execute: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- =====================================================

-- 1. CRIAR FUNÇÃO PARA CHAMAR NETLIFY FUNCTION VIA HTTP
CREATE OR REPLACE FUNCTION sistemaretiradas.processar_fila_whatsapp_unificada()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_netlify_url TEXT;
    v_request_id BIGINT;
    v_response JSONB;
BEGIN
    -- Obter URL do Netlify da tabela app_config (ou usar fallback)
    SELECT value INTO v_netlify_url
    FROM sistemaretiradas.app_config
    WHERE key = 'netlify_url'
    LIMIT 1;

    IF v_netlify_url IS NULL OR v_netlify_url = '' THEN
        v_netlify_url = 'https://eleveaone.com.br'; -- Fallback
    END IF;

    -- Construir URL completa da Netlify Function
    v_netlify_url := v_netlify_url || '/.netlify/functions/process-whatsapp-queue';

    -- Tentar chamar Netlify Function via HTTP usando pg_net
    BEGIN
        SELECT net.http_post(
            url := v_netlify_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json'
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 30000 -- 30 segundos de timeout
        ) INTO v_request_id;

        RAISE NOTICE '✅ Chamada para processar fila unificada de WhatsApp enviada (Request ID: %)', v_request_id;

        RETURN json_build_object(
            'success', true,
            'message', 'Chamada enviada com sucesso',
            'request_id', v_request_id,
            'netlify_url', v_netlify_url
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ Erro ao chamar Netlify Function: %', SQLERRM;
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'netlify_url', v_netlify_url
        );
    END;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.processar_fila_whatsapp_unificada IS 
'Chama Netlify Function process-whatsapp-queue para processar fila unificada de WhatsApp. Usado pelo cron job.';

-- 2. CRIAR CRON JOB PARA PROCESSAR FILA A CADA 1 MINUTO
-- IMPORTANTE: pg_cron precisa estar habilitado
-- Para habilitar, execute no Supabase SQL Editor:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover job antigo se existir (para evitar duplicatas)
DO $$
DECLARE
    v_job_id BIGINT;
BEGIN
    -- Buscar job antigo pelo nome
    SELECT jobid INTO v_job_id
    FROM cron.job
    WHERE jobname = 'processar-fila-whatsapp-unificada';
    
    -- Se encontrou, remover
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule('processar-fila-whatsapp-unificada');
        RAISE NOTICE '⚠️ Job antigo removido: %', v_job_id;
    END IF;
END $$;

-- Agendar job para executar a cada 1 minuto
SELECT cron.schedule(
    'processar-fila-whatsapp-unificada',  -- Nome do job
    '* * * * *',                          -- A cada minuto (cron expression)
    $$
    SELECT sistemaretiradas.processar_fila_whatsapp_unificada();
    $$
);

-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
COMMENT ON FUNCTION sistemaretiradas.processar_fila_whatsapp_unificada IS 
'Processa fila unificada de WhatsApp (campanhas, cashback, notificações) a cada 1 minuto. Chama process-whatsapp-queue.';

-- =====================================================
-- COMANDOS ÚTEIS PARA GERENCIAR CRON JOB
-- =====================================================

-- Ver todos os cron jobs:
-- SELECT * FROM cron.job ORDER BY jobid;

-- Ver logs do cron job:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'processar-fila-whatsapp-unificada')
-- ORDER BY start_time DESC 
-- LIMIT 20;

-- Ver status específico do job:
-- SELECT * FROM cron.job WHERE jobname = 'processar-fila-whatsapp-unificada';

-- Parar o cron job:
-- SELECT cron.unschedule('processar-fila-whatsapp-unificada');

-- Reativar o cron job:
-- SELECT cron.schedule('processar-fila-whatsapp-unificada', '* * * * *', 
--   'SELECT sistemaretiradas.processar_fila_whatsapp_unificada();');

-- =====================================================
-- NOTA: Se pg_cron não estiver disponível
-- =====================================================

-- Alternativa 1: Usar Netlify Scheduled Functions (netlify.toml)
-- [[functions]]
--   name = "process-whatsapp-queue"
--   schedule = "* * * * *"  # A cada minuto

-- Alternativa 2: Usar N8N para chamar a função periodicamente
-- Criar workflow N8N que chama POST https://eleveaone.com.br/.netlify/functions/process-whatsapp-queue

-- Alternativa 3: Usar Supabase Edge Function com cron job do Supabase Dashboard

