-- ============================================================================
-- MIGRATION: Criar Scheduled Job para Processar Fila de WhatsApp
-- Data: 2025-01-31
-- Descrição: Cria agendamento para chamar Edge Function a cada 1 minuto
-- ============================================================================

-- ============================================================================
-- NOTA: Esta migration requer que pg_cron esteja habilitado
-- Para habilitar: Supabase Dashboard > Database > Extensions > Enable pg_cron
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE pg_cron ESTÁ HABILITADO
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE NOTICE '⚠️ pg_cron não está habilitado. Habilite em: Supabase Dashboard > Database > Extensions';
        RAISE NOTICE '   Depois execute esta migration novamente.';
    END IF;
END $$;

-- ============================================================================
-- 2. CRIAR FUNÇÃO PARA CHAMAR EDGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_processar_fila_whatsapp()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_service_key TEXT;
    v_url TEXT;
    v_result JSON;
BEGIN
    -- Obter service_role_key da configuração
    SELECT value INTO v_service_key
    FROM sistemaretiradas.app_config
    WHERE key = 'service_role_key';

    IF v_service_key IS NULL OR v_service_key = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'service_role_key não configurada em app_config'
        );
    END IF;

    -- URL da Edge Function
    v_url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue';

    -- Tentar chamar via http extension (requer extensão http)
    BEGIN
        -- Verificar se extensão http está disponível
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
            -- Usar http extension
            SELECT content::JSON INTO v_result
            FROM http((
                'POST',
                v_url,
                ARRAY[
                    http_header('Authorization', 'Bearer ' || v_service_key),
                    http_header('Content-Type', 'application/json')
                ],
                'application/json',
                '{}'
            )::http_request);
            
            RETURN COALESCE(v_result, json_build_object('success', true, 'message', 'Chamada realizada'));
        ELSE
            RAISE NOTICE '⚠️ Extensão http não disponível. Use serviço externo para agendar.';
            RETURN json_build_object(
                'success', false,
                'error', 'Extensão http não disponível'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '⚠️ Erro ao chamar Edge Function: %', SQLERRM;
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
    END;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.chamar_processar_fila_whatsapp IS 'Chama Edge Function para processar fila de WhatsApp de cashback. Usado por cron job.';

-- ============================================================================
-- 3. AGENDAR JOB PARA EXECUTAR A CADA 1 MINUTO
-- ============================================================================

-- Remover job existente se houver
SELECT cron.unschedule('processar-fila-whatsapp-cashback') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback'
);

-- Criar novo job
SELECT cron.schedule(
    'processar-fila-whatsapp-cashback',  -- Nome do job
    '* * * * *',                         -- A cada minuto (cron expression)
    $$
    SELECT sistemaretiradas.chamar_processar_fila_whatsapp();
    $$
);

COMMENT ON FUNCTION sistemaretiradas.chamar_processar_fila_whatsapp IS 'Agendado para executar a cada 1 minuto via pg_cron';

-- ============================================================================
-- 4. VERIFICAR JOB CRIADO
-- ============================================================================

-- Para ver todos os jobs:
-- SELECT * FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback';

-- Para ver logs de execução:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback')
-- ORDER BY start_time DESC LIMIT 10;

-- ============================================================================
-- 5. COMANDOS ÚTEIS
-- ============================================================================

-- Parar o job:
-- SELECT cron.unschedule('processar-fila-whatsapp-cashback');

-- Alterar schedule (exemplo: a cada 5 minutos):
-- SELECT cron.alter_job(
--     (SELECT jobid FROM cron.job WHERE jobname = 'processar-fila-whatsapp-cashback'),
--     schedule := '*/5 * * * *'
-- );

