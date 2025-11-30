-- ============================================================================
-- MIGRATION: Adicionar Cron Job para Processar Fila de WhatsApp
-- Data: 2025-01-31
-- Descrição: Cria cron job para processar fila de WhatsApp automaticamente a cada 1 minuto
-- ============================================================================

-- ============================================================================
-- 1. HABILITAR EXTENSÃO pg_cron (se ainda não estiver habilitada)
-- ============================================================================

-- Nota: pg_cron precisa ser habilitada pelo superuser do Supabase
-- Execute no Supabase Dashboard > Database > Extensions > Enable pg_cron
-- Ou peça ao admin do Supabase para habilitar

-- ============================================================================
-- 2. CRIAR FUNÇÃO PARA CHAMAR NETLIFY FUNCTION VIA HTTP
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.processar_fila_whatsapp_cashback()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_netlify_url TEXT;
    v_request_id BIGINT;
    v_response JSONB;
BEGIN
    -- Obter URL do Netlify da tabela app_config
    SELECT value INTO v_netlify_url
    FROM sistemaretiradas.app_config
    WHERE key = 'netlify_url';

    IF v_netlify_url IS NULL OR v_netlify_url = '' THEN
        v_netlify_url = 'https://eleveaone.com.br'; -- Fallback
    END IF;

    -- Construir URL completa da Netlify Function
    v_netlify_url := v_netlify_url || '/.netlify/functions/process-cashback-whatsapp-queue';

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

        RAISE NOTICE '✅ Chamada para processar fila de WhatsApp enviada (Request ID: %)', v_request_id;

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

COMMENT ON FUNCTION sistemaretiradas.processar_fila_whatsapp_cashback IS 'Chama Netlify Function para processar fila de WhatsApp de cashback. Usado pelo cron job.';

-- ============================================================================
-- 3. CRIAR CRON JOB PARA PROCESSAR FILA A CADA 1 MINUTO
-- ============================================================================

-- IMPORTANTE: pg_cron precisa estar habilitado
-- Para habilitar, execute no Supabase SQL Editor:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar job para executar a cada 1 minuto
SELECT cron.schedule(
    'processar-fila-whatsapp-cashback',  -- Nome do job
    '* * * * *',                         -- A cada minuto (cron expression)
    $$
    SELECT sistemaretiradas.processar_fila_whatsapp_cashback();
    $$
);

COMMENT ON FUNCTION sistemaretiradas.processar_fila_whatsapp_cashback IS 'Processa fila de WhatsApp de cashback a cada 1 minuto';

-- ============================================================================
-- 4. VERIFICAR CRON JOBS EXISTENTES
-- ============================================================================

-- Para ver todos os cron jobs:
-- SELECT * FROM cron.job;

-- Para ver logs do cron job:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback');

-- ============================================================================
-- 5. COMANDOS ÚTEIS PARA GERENCIAR CRON JOB
-- ============================================================================

-- Parar o cron job:
-- SELECT cron.unschedule('processar-fila-whatsapp-cashback');

-- Ver status do cron job:
-- SELECT * FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback';

-- ============================================================================
-- NOTA: Se pg_cron não estiver disponível, usar alternativa abaixo
-- ============================================================================

/*
ALTERNATIVA: Usar Supabase Edge Function com cron job do Supabase Dashboard
ou usar serviço externo como n8n, Zapier, etc.

Ou criar uma Edge Function que verifica a fila e chama a Netlify Function:
- Criar edge function: supabase/functions/process-cashback-queue
- Configurar cron job no Supabase Dashboard para chamar essa função
*/

