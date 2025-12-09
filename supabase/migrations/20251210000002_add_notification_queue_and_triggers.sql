-- =====================================================
-- FILA DE NOTIFICAÇÕES E TRIGGERS PARA ENVIO AUTOMÁTICO
-- =====================================================

-- Tabela de fila de notificações
CREATE TABLE IF NOT EXISTS sistemaretiradas.store_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES sistemaretiradas.store_notifications(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES sistemaretiradas.store_notification_recipients(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_store_notification_queue_status ON sistemaretiradas.store_notification_queue(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_store_notification_queue_notification_id ON sistemaretiradas.store_notification_queue(notification_id);
CREATE INDEX IF NOT EXISTS idx_store_notification_queue_created_at ON sistemaretiradas.store_notification_queue(created_at);

-- RLS
ALTER TABLE sistemaretiradas.store_notification_queue ENABLE ROW LEVEL SECURITY;

-- Policies para store_notification_queue (apenas admins podem ver)
DROP POLICY IF EXISTS "admin_read_store_notification_queue" ON sistemaretiradas.store_notification_queue;
CREATE POLICY "admin_read_store_notification_queue" ON sistemaretiradas.store_notification_queue
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            JOIN sistemaretiradas.store_notifications sn ON sn.id = store_notification_queue.notification_id
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = sn.store_id))
        )
    );

-- Função RPC atualizada para inserir mensagens na fila
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
    -- NOW() retorna timestamp com timezone, então convertemos para America/Sao_Paulo
    v_current_timestamp_brasilia := (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo';
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
        
        -- Incrementar contador de envios
        UPDATE sistemaretiradas.store_notifications
        SET envios_hoje = envios_hoje + 1
        WHERE id = v_alert.id;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'queued_count', v_queue_count,
        'error_count', v_error_count
    );
END;
$$;

-- Função para resetar contador de envios diários (executar à meia-noite)
CREATE OR REPLACE FUNCTION sistemaretiradas.reset_daily_sends()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sistemaretiradas.store_notifications
    SET envios_hoje = 0
    WHERE envios_hoje > 0;
END;
$$;

-- Comentários
COMMENT ON TABLE sistemaretiradas.store_notification_queue IS 'Fila de mensagens de notificações aguardando envio via WhatsApp';
COMMENT ON FUNCTION sistemaretiradas.process_store_task_alerts() IS 'Processa alertas e insere mensagens na fila para envio (chamado por cron job)';
COMMENT ON FUNCTION sistemaretiradas.reset_daily_sends() IS 'Reseta contador de envios diários (executar à meia-noite)';

