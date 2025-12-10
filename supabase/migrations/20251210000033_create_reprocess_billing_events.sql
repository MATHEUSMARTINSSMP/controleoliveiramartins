-- =====================================================
-- FUNÇÃO: Reprocessar evento de billing
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.reprocess_billing_event(
    p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event sistemaretiradas.billing_events;
    v_result JSON;
BEGIN
    -- Buscar evento
    SELECT * INTO v_event
    FROM sistemaretiradas.billing_events
    WHERE id = p_event_id;
    
    IF v_event IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Event not found');
    END IF;
    
    -- Resetar status para reprocessamento
    UPDATE sistemaretiradas.billing_events
    SET 
        processed = false,
        error_message = NULL,
        retry_count = COALESCE(retry_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_event_id;
    
    -- Chamar função de processamento
    SELECT sistemaretiradas.process_billing_event(
        v_event.payment_gateway,
        v_event.external_event_id,
        v_event.event_type,
        v_event.event_data
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.reprocess_billing_event(UUID) IS 'Reprocessa um evento de billing que falhou ou está pendente';

GRANT EXECUTE ON FUNCTION sistemaretiradas.reprocess_billing_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.reprocess_billing_event(UUID) TO service_role;

-- =====================================================
-- FUNÇÃO: Reprocessar eventos falhos automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.reprocess_failed_billing_events()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event RECORD;
    v_processed INTEGER := 0;
    v_errors INTEGER := 0;
    v_result JSON;
BEGIN
    -- Buscar eventos não processados sem erro (pendentes) ou com erro (para retry)
    -- Limitar a 3 tentativas
    FOR v_event IN
        SELECT *
        FROM sistemaretiradas.billing_events
        WHERE (
            (processed = false AND error_message IS NULL)
            OR (processed = false AND error_message IS NOT NULL AND COALESCE(retry_count, 0) < 3)
        )
        AND created_at > NOW() - INTERVAL '7 days' -- Apenas eventos dos últimos 7 dias
        ORDER BY created_at ASC
        LIMIT 50 -- Processar até 50 eventos por vez
    LOOP
        BEGIN
            -- Reprocessar evento
            SELECT sistemaretiradas.reprocess_billing_event(v_event.id) INTO v_result;
            
            IF (v_result->>'success')::boolean THEN
                v_processed := v_processed + 1;
            ELSE
                v_errors := v_errors + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_errors := v_errors + 1;
                -- Marcar como erro após 3 tentativas
                IF COALESCE(v_event.retry_count, 0) >= 2 THEN
                    UPDATE sistemaretiradas.billing_events
                    SET 
                        error_message = SQLERRM,
                        updated_at = NOW()
                    WHERE id = v_event.id;
                END IF;
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'processed', v_processed,
        'errors', v_errors,
        'message', format('Processados: %s, Erros: %s', v_processed, v_errors)
    );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.reprocess_failed_billing_events() IS 'Reprocessa automaticamente eventos de billing falhos ou pendentes (máximo 3 tentativas)';

GRANT EXECUTE ON FUNCTION sistemaretiradas.reprocess_failed_billing_events() TO service_role;

-- =====================================================
-- FUNÇÃO: Chamar reprocessamento via HTTP (para pg_cron)
-- =====================================================
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_reprocessar_eventos_billing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Chamar diretamente a função RPC para reprocessar eventos
    PERFORM sistemaretiradas.reprocess_failed_billing_events();
    
    -- Se quiser chamar via HTTP no futuro (requer extensão http):
    -- v_netlify_url := 'https://eleveaone.com.br/.netlify/functions/reprocess-billing-events';
    -- SELECT * INTO v_response FROM http_post(
    --     v_netlify_url,
    --     '{}'::jsonb,
    --     'application/json'::text
    -- );
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.chamar_reprocessar_eventos_billing() IS 'Chama reprocessamento de eventos de billing (para uso com pg_cron)';

GRANT EXECUTE ON FUNCTION sistemaretiradas.chamar_reprocessar_eventos_billing() TO service_role;

-- =====================================================
-- CRON JOB: Reprocessar eventos a cada hora
-- =====================================================
-- Verificar se pg_cron está disponível
DO $$
DECLARE
    v_job_exists BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Verificar se o job já existe
        SELECT EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'reprocess-billing-events'
        ) INTO v_job_exists;
        
        -- Remover job existente se houver
        IF v_job_exists THEN
            PERFORM cron.unschedule('reprocess-billing-events');
        END IF;
        
        -- Agendar job para rodar a cada hora
        PERFORM cron.schedule(
            'reprocess-billing-events',
            '0 * * * *', -- A cada hora
            'SELECT sistemaretiradas.chamar_reprocessar_eventos_billing()'
        );
        
        RAISE NOTICE 'Cron job "reprocess-billing-events" agendado para rodar a cada hora';
    ELSE
        RAISE NOTICE 'pg_cron não está disponível. Job não foi agendado.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Se der erro ao remover, tentar criar mesmo assim
        BEGIN
            PERFORM cron.schedule(
                'reprocess-billing-events',
                '0 * * * *',
                'SELECT sistemaretiradas.chamar_reprocessar_eventos_billing()'
            );
            RAISE NOTICE 'Cron job "reprocess-billing-events" agendado (job anterior não encontrado, criado novo)';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao agendar cron job: %', SQLERRM;
        END;
END $$;

-- Adicionar coluna retry_count se não existir
ALTER TABLE sistemaretiradas.billing_events
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN sistemaretiradas.billing_events.retry_count IS 'Número de tentativas de reprocessamento';

