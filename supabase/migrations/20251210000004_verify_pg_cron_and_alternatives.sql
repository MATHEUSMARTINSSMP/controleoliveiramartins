-- =====================================================
-- VERIFICAÇÃO DE pg_cron E ALTERNATIVAS
-- =====================================================

-- Função para verificar status do pg_cron
CREATE OR REPLACE FUNCTION sistemaretiradas.verificar_status_cron()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pg_cron_enabled BOOLEAN;
    v_pg_net_enabled BOOLEAN;
    v_http_enabled BOOLEAN;
    v_jobs_count INTEGER;
    v_result JSON;
BEGIN
    -- Verificar se pg_cron está habilitado
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) INTO v_pg_cron_enabled;
    
    -- Verificar se pg_net está habilitado
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) INTO v_pg_net_enabled;
    
    -- Verificar se http extension está habilitado
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'http'
    ) INTO v_http_enabled;
    
    -- Contar jobs do pg_cron
    IF v_pg_cron_enabled THEN
        SELECT COUNT(*) INTO v_jobs_count
        FROM cron.job
        WHERE jobname IN ('process-store-task-alerts', 'reset-daily-sends');
    ELSE
        v_jobs_count := 0;
    END IF;
    
    -- Montar resultado
    v_result := json_build_object(
        'pg_cron_enabled', v_pg_cron_enabled,
        'pg_net_enabled', v_pg_net_enabled,
        'http_enabled', v_http_enabled,
        'cron_jobs_count', v_jobs_count,
        'recommendation', CASE
            WHEN v_pg_cron_enabled THEN 'pg_cron está habilitado. Sistema funcionando normalmente.'
            WHEN v_pg_net_enabled OR v_http_enabled THEN 'pg_cron não está habilitado, mas extensões HTTP estão disponíveis. Configure Netlify Scheduled Functions como alternativa.'
            ELSE 'pg_cron não está habilitado e nenhuma extensão HTTP está disponível. Configure Netlify Scheduled Functions ou habilite pg_cron no Supabase Dashboard.'
        END
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.verificar_status_cron() IS 'Verifica status do pg_cron e extensões HTTP, retornando recomendação de configuração';

