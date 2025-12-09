-- =====================================================
-- CORRIGIR FUNÇÃO process_store_task_alerts
-- =====================================================
-- Esta função deve inserir mensagens na fila (store_notification_queue)
-- e não apenas registrar. A Netlify Function processa a fila.

-- Atualizar função para inserir na fila corretamente
CREATE OR REPLACE FUNCTION sistemaretiradas.process_store_task_alerts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_time TIME;
    v_current_day INTEGER;
    v_alert RECORD;
    v_recipient RECORD;
    v_queue_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- Obter hora atual e dia da semana (0=domingo, 6=sábado)
    v_current_time := CURRENT_TIME;
    v_current_day := EXTRACT(DOW FROM CURRENT_DATE);
    
    -- Buscar alertas ativos que devem ser enviados agora
    FOR v_alert IN
        SELECT 
            sn.*,
            s.name as store_name,
            s.whatsapp_ativo
        FROM sistemaretiradas.store_notifications sn
        JOIN sistemaretiradas.stores s ON s.id = sn.store_id
        WHERE sn.ativo = true
        AND s.whatsapp_ativo = true
        AND sn.envios_hoje < 10
        AND v_current_day = ANY(sn.dias_semana)
        AND EXISTS (
            SELECT 1 FROM unnest(sn.horarios) AS h
            WHERE h::TIME <= v_current_time
            AND h::TIME >= v_current_time - INTERVAL '1 minute'
        )
    LOOP
        -- Buscar destinatários ativos
        FOR v_recipient IN
            SELECT * FROM sistemaretiradas.store_notification_recipients
            WHERE notification_id = v_alert.id
            AND ativo = true
        LOOP
            -- Verificar se já existe mensagem pendente para este destinatário hoje
            IF NOT EXISTS (
                SELECT 1 FROM sistemaretiradas.store_notification_queue
                WHERE notification_id = v_alert.id
                AND recipient_id = v_recipient.id
                AND status = 'PENDING'
                AND created_at::DATE = CURRENT_DATE
            ) THEN
                -- ✅ INSERIR NA FILA (isso é o que estava faltando!)
                INSERT INTO sistemaretiradas.store_notification_queue (
                    notification_id,
                    recipient_id,
                    phone,
                    message,
                    status
                ) VALUES (
                    v_alert.id,
                    v_recipient.id,
                    v_recipient.phone,
                    v_alert.mensagem,
                    'PENDING'
                );
                
                v_queue_count := v_queue_count + 1;
            END IF;
        END LOOP;
        
        -- Incrementar contador de envios apenas se inseriu na fila
        IF v_queue_count > 0 THEN
            UPDATE sistemaretiradas.store_notifications
            SET envios_hoje = envios_hoje + 1
            WHERE id = v_alert.id;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'queued_count', v_queue_count,
        'error_count', v_error_count
    );
END;
$$;

-- Comentário atualizado
COMMENT ON FUNCTION sistemaretiradas.process_store_task_alerts() IS 
'Processa alertas e insere mensagens na fila store_notification_queue para envio via WhatsApp. A Netlify Function process-store-task-alerts.js processa a fila.';

