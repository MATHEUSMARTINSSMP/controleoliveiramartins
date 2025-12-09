-- =====================================================
-- SISTEMA DE NOTIFICAÇÕES DE TAREFAS POR LOJA
-- =====================================================

-- Tabela de notificações/tarefas
CREATE TABLE IF NOT EXISTS sistemaretiradas.store_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    horarios TEXT[] NOT NULL DEFAULT '{}',
    dias_semana INTEGER[] NOT NULL DEFAULT '{}',
    sender_type TEXT NOT NULL DEFAULT 'GLOBAL' CHECK (sender_type IN ('GLOBAL', 'STORE')),
    sender_phone TEXT,
    ativo BOOLEAN DEFAULT true,
    envios_hoje INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de destinatários das notificações
CREATE TABLE IF NOT EXISTS sistemaretiradas.store_notification_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES sistemaretiradas.store_notifications(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_store_notifications_store_id ON sistemaretiradas.store_notifications(store_id);
CREATE INDEX IF NOT EXISTS idx_store_notifications_ativo ON sistemaretiradas.store_notifications(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_store_notification_recipients_notification_id ON sistemaretiradas.store_notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_store_notification_recipients_ativo ON sistemaretiradas.store_notification_recipients(ativo) WHERE ativo = true;

-- RLS
ALTER TABLE sistemaretiradas.store_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.store_notification_recipients ENABLE ROW LEVEL SECURITY;

-- Policies para store_notifications
DROP POLICY IF EXISTS "admin_read_store_notifications" ON sistemaretiradas.store_notifications;
CREATE POLICY "admin_read_store_notifications" ON sistemaretiradas.store_notifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = store_notifications.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_insert_store_notifications" ON sistemaretiradas.store_notifications;
CREATE POLICY "admin_insert_store_notifications" ON sistemaretiradas.store_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = store_notifications.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_update_store_notifications" ON sistemaretiradas.store_notifications;
CREATE POLICY "admin_update_store_notifications" ON sistemaretiradas.store_notifications
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = store_notifications.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_delete_store_notifications" ON sistemaretiradas.store_notifications;
CREATE POLICY "admin_delete_store_notifications" ON sistemaretiradas.store_notifications
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = store_notifications.store_id))
        )
    );

-- Policies para store_notification_recipients
DROP POLICY IF EXISTS "admin_read_store_notification_recipients" ON sistemaretiradas.store_notification_recipients;
CREATE POLICY "admin_read_store_notification_recipients" ON sistemaretiradas.store_notification_recipients
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            JOIN sistemaretiradas.store_notifications sn ON sn.id = store_notification_recipients.notification_id
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = sn.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_insert_store_notification_recipients" ON sistemaretiradas.store_notification_recipients;
CREATE POLICY "admin_insert_store_notification_recipients" ON sistemaretiradas.store_notification_recipients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            JOIN sistemaretiradas.store_notifications sn ON sn.id = store_notification_recipients.notification_id
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = sn.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_update_store_notification_recipients" ON sistemaretiradas.store_notification_recipients;
CREATE POLICY "admin_update_store_notification_recipients" ON sistemaretiradas.store_notification_recipients
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            JOIN sistemaretiradas.store_notifications sn ON sn.id = store_notification_recipients.notification_id
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = sn.store_id))
        )
    );

DROP POLICY IF EXISTS "admin_delete_store_notification_recipients" ON sistemaretiradas.store_notification_recipients;
CREATE POLICY "admin_delete_store_notification_recipients" ON sistemaretiradas.store_notification_recipients
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles p
            JOIN sistemaretiradas.store_notifications sn ON sn.id = store_notification_recipients.notification_id
            WHERE p.id = auth.uid()
            AND (p.role = 'ADMIN' OR (p.role = 'LOJA' AND p.store_id = sn.store_id))
        )
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_store_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_store_notifications_updated_at ON sistemaretiradas.store_notifications;
CREATE TRIGGER trigger_update_store_notifications_updated_at
    BEFORE UPDATE ON sistemaretiradas.store_notifications
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_store_notifications_updated_at();

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

-- Função RPC para processar e enviar alertas (será chamada por cron job)
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
    v_sent_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_results JSONB := '[]'::JSONB;
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
            -- Aqui seria feita a chamada para enviar via WhatsApp
            -- Por enquanto, apenas registramos
            v_sent_count := v_sent_count + 1;
            
            -- Incrementar contador de envios
            UPDATE sistemaretiradas.store_notifications
            SET envios_hoje = envios_hoje + 1
            WHERE id = v_alert.id;
            
            -- Adicionar ao resultado
            v_results := v_results || jsonb_build_object(
                'alert_id', v_alert.id,
                'alert_name', v_alert.nome,
                'recipient_phone', v_recipient.phone,
                'sent_at', NOW()
            );
        END LOOP;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'sent_count', v_sent_count,
        'error_count', v_error_count,
        'results', v_results
    );
END;
$$;

COMMENT ON TABLE sistemaretiradas.store_notifications IS 'Notificações/tarefas programadas por loja';
COMMENT ON TABLE sistemaretiradas.store_notification_recipients IS 'Destinatários das notificações';
COMMENT ON FUNCTION sistemaretiradas.process_store_task_alerts() IS 'Processa e envia alertas de tarefas programadas (chamado por cron job)';
COMMENT ON FUNCTION sistemaretiradas.reset_daily_sends() IS 'Reseta contador de envios diários (executar à meia-noite)';

