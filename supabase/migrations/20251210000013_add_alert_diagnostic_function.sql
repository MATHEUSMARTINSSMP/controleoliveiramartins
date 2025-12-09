-- =====================================================
-- FUNÇÃO DE DIAGNÓSTICO DO SISTEMA DE ALERTAS
-- =====================================================
-- Esta função ajuda a diagnosticar problemas no sistema de alertas

CREATE OR REPLACE FUNCTION sistemaretiradas.diagnosticar_sistema_alertas()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_current_time TIME;
    v_current_day INTEGER;
    v_current_hour_minute TEXT;
    v_current_timestamp_brasilia TIMESTAMPTZ;
    v_active_alerts_count INTEGER;
    v_pending_queue_count INTEGER;
    v_sent_today_count INTEGER;
    v_failed_today_count INTEGER;
    v_stores_with_whatsapp INTEGER;
    v_cron_job_exists BOOLEAN;
BEGIN
    -- CORREÇÃO: Converter para horário de Brasília (UTC-3)
    -- Os horários configurados são sempre em horário de Brasília
    v_current_timestamp_brasilia := (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo';
    v_current_time := v_current_timestamp_brasilia::TIME;
    v_current_day := EXTRACT(DOW FROM v_current_timestamp_brasilia::DATE);
    v_current_hour_minute := TO_CHAR(v_current_time, 'HH24:MI');
    
    -- Contar alertas ativos
    SELECT COUNT(*) INTO v_active_alerts_count
    FROM sistemaretiradas.store_notifications sn
    JOIN sistemaretiradas.stores s ON s.id = sn.store_id
    WHERE sn.ativo = true
    AND s.whatsapp_ativo = true;
    
    -- Contar mensagens pendentes na fila
    SELECT COUNT(*) INTO v_pending_queue_count
    FROM sistemaretiradas.store_notification_queue
    WHERE status = 'PENDING';
    
    -- Contar mensagens enviadas hoje
    SELECT COUNT(*) INTO v_sent_today_count
    FROM sistemaretiradas.store_notification_queue
    WHERE status = 'SENT'
    AND sent_at::DATE = CURRENT_DATE;
    
    -- Contar mensagens falhadas hoje
    SELECT COUNT(*) INTO v_failed_today_count
    FROM sistemaretiradas.store_notification_queue
    WHERE status = 'FAILED'
    AND created_at::DATE = CURRENT_DATE;
    
    -- Contar lojas com WhatsApp ativo
    SELECT COUNT(*) INTO v_stores_with_whatsapp
    FROM sistemaretiradas.stores
    WHERE whatsapp_ativo = true
    AND active = true;
    
    -- Verificar se cron job existe
    SELECT EXISTS (
        SELECT 1 FROM cron.job
        WHERE jobname = 'process-store-task-alerts'
    ) INTO v_cron_job_exists;
    
    -- Construir resultado
    v_result := json_build_object(
        'timestamp', NOW(),
        'current_time', v_current_time::TEXT,
        'current_hour_minute', v_current_hour_minute,
        'current_day', v_current_day,
        'current_day_name', CASE v_current_day
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
        END,
        'active_alerts_count', v_active_alerts_count,
        'pending_queue_count', v_pending_queue_count,
        'sent_today_count', v_sent_today_count,
        'failed_today_count', v_failed_today_count,
        'stores_with_whatsapp', v_stores_with_whatsapp,
        'cron_job_exists', v_cron_job_exists,
        'alerts_that_should_trigger_now', (
            SELECT json_agg(json_build_object(
                'alert_id', sn.id,
                'alert_name', sn.nome,
                'store_name', s.name,
                'horarios', sn.horarios,
                'dias_semana', sn.dias_semana,
                'envios_hoje', sn.envios_hoje,
                'recipients_count', (
                    SELECT COUNT(*) 
                    FROM sistemaretiradas.store_notification_recipients
                    WHERE notification_id = sn.id AND ativo = true
                )
            ))
            FROM sistemaretiradas.store_notifications sn
            JOIN sistemaretiradas.stores s ON s.id = sn.store_id
            WHERE sn.ativo = true
            AND s.whatsapp_ativo = true
            AND sn.envios_hoje < 10
            AND v_current_day = ANY(sn.dias_semana)
            AND EXISTS (
                SELECT 1 FROM unnest(sn.horarios) AS h
                WHERE TO_CHAR(h::TIME, 'HH24:MI') = v_current_hour_minute
            )
        )
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.diagnosticar_sistema_alertas() IS 'Diagnostica o sistema de alertas, retornando informações sobre status, contadores e alertas que deveriam ser disparados agora.';

