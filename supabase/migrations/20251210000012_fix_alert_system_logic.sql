-- =====================================================
-- CORREÇÃO DO SISTEMA DE ALERTAS
-- =====================================================
-- Este migration corrige problemas críticos no sistema de alertas:
-- 1. Lógica de comparação de horários (comparar apenas HH:MM, ignorando segundos)
-- 2. Verificação de duplicatas (verificar SENT e PENDING, não apenas PENDING)

-- Atualizar função process_store_task_alerts com lógica corrigida
CREATE OR REPLACE FUNCTION sistemaretiradas.process_store_task_alerts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_time TIME;
    v_current_day INTEGER;
    v_current_hour_minute TEXT;
    v_current_timestamp_brasilia TIMESTAMPTZ;
    v_alert RECORD;
    v_recipient RECORD;
    v_queue_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- CORREÇÃO: Converter para horário de Brasília (UTC-3)
    -- Os horários configurados são sempre em horário de Brasília
    -- NOW() retorna TIMESTAMPTZ (com timezone), então convertemos diretamente para America/Sao_Paulo
    -- A sintaxe correta: NOW() AT TIME ZONE 'America/Sao_Paulo' retorna timestamp sem timezone no horário local
    v_current_timestamp_brasilia := NOW() AT TIME ZONE 'America/Sao_Paulo';
    v_current_time := v_current_timestamp_brasilia::TIME;
    v_current_day := EXTRACT(DOW FROM v_current_timestamp_brasilia::DATE);
    
    -- Obter hora e minuto atual em Brasília (sem segundos) para comparação precisa
    -- Formato: HH:MM (ex: 20:09)
    v_current_hour_minute := TO_CHAR(v_current_time, 'HH24:MI');
    
    -- Buscar alertas ativos que devem ser enviados agora
    -- CORREÇÃO: Comparar apenas horas e minutos, ignorando segundos
    -- Isso garante que alertas sejam enviados mesmo se o cron rodar em qualquer segundo do minuto
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
            WHERE TO_CHAR(h::TIME, 'HH24:MI') = v_current_hour_minute
        )
    LOOP
        -- Buscar destinatários ativos
        FOR v_recipient IN
            SELECT * FROM sistemaretiradas.store_notification_recipients
            WHERE notification_id = v_alert.id
            AND ativo = true
        LOOP
            -- Verificar se já existe mensagem enviada ou pendente para este destinatário hoje
            -- CORREÇÃO: Verificar tanto PENDING quanto SENT para evitar duplicatas
            IF NOT EXISTS (
                SELECT 1 FROM sistemaretiradas.store_notification_queue
                WHERE notification_id = v_alert.id
                AND recipient_id = v_recipient.id
                AND status IN ('PENDING', 'SENT')
                AND created_at::DATE = CURRENT_DATE
            ) THEN
                -- Inserir na fila
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
        
        -- Incrementar contador de envios apenas se houver mensagens na fila
        IF v_queue_count > 0 THEN
            UPDATE sistemaretiradas.store_notifications
            SET envios_hoje = envios_hoje + 1
            WHERE id = v_alert.id;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'queued_count', v_queue_count,
        'error_count', v_error_count,
        'current_time', v_current_hour_minute,
        'current_day', v_current_day
    );
END;
$$;

-- Conceder permissão de execução para usuários autenticados (necessário para RPC)
GRANT EXECUTE ON FUNCTION sistemaretiradas.process_store_task_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.process_store_task_alerts() TO anon;

-- Comentário atualizado
COMMENT ON FUNCTION sistemaretiradas.process_store_task_alerts() IS 'Processa alertas e insere mensagens na fila para envio (chamado por cron job). CORRIGIDO: Compara apenas HH:MM e verifica duplicatas corretamente.';

