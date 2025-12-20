-- =====================================================
-- GARANTIR COLUNAS DE AGENDAMENTO EM WHATSAPP_MESSAGE_QUEUE
-- =====================================================
-- Esta migration garante que todas as colunas necessárias
-- para agendamento de mensagens existam na tabela whatsapp_message_queue
-- 
-- Usa IF NOT EXISTS para ser idempotente e evitar erros
-- =====================================================

-- 1. Verificar e adicionar colunas de agendamento se não existirem
DO $$ 
BEGIN
    -- scheduled_for: Data/hora para agendamento futuro
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'scheduled_for'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN scheduled_for TIMESTAMPTZ;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.scheduled_for IS 
        'Data e hora agendada para envio da mensagem (NULL = enviar imediatamente)';
    END IF;

    -- allowed_start_hour: Hora inicial permitida para envio (0-23)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'allowed_start_hour'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN allowed_start_hour INTEGER 
        CHECK (allowed_start_hour >= 0 AND allowed_start_hour <= 23);
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.allowed_start_hour IS 
        'Hora inicial permitida para envio (0-23, NULL = sem restrição)';
    END IF;

    -- allowed_end_hour: Hora final permitida para envio (0-23)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'allowed_end_hour'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN allowed_end_hour INTEGER 
        CHECK (allowed_end_hour >= 0 AND allowed_end_hour <= 23);
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.allowed_end_hour IS 
        'Hora final permitida para envio (0-23, NULL = sem restrição)';
    END IF;

    -- interval_seconds: Intervalo mínimo entre mensagens (já deve existir, mas garantimos)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'interval_seconds'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN interval_seconds INTEGER DEFAULT 5;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.interval_seconds IS 
        'Intervalo mínimo em segundos entre mensagens para o mesmo número';
    END IF;

    -- max_per_day_per_contact: Limite de mensagens por contato por dia
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'max_per_day_per_contact'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN max_per_day_per_contact INTEGER;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.max_per_day_per_contact IS 
        'Limite máximo de mensagens por contato (phone) por dia (NULL = sem limite)';
    END IF;

    -- max_total_per_day: Limite total de mensagens por dia para a campanha/loja
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'max_total_per_day'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN max_total_per_day INTEGER;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.max_total_per_day IS 
        'Limite total de mensagens por dia para a campanha/loja (NULL = sem limite)';
    END IF;

    -- metadata: Dados adicionais em JSONB (para contato, variação, etc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_message_queue' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_message_queue
        ADD COLUMN metadata JSONB DEFAULT '{}';
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.metadata IS 
        'Metadados adicionais em JSON (contact_id, contact_name, variation_id, etc)';
    END IF;

END $$;

-- 2. Garantir índices para performance em agendamento
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_scheduled_for 
    ON sistemaretiradas.whatsapp_message_queue(scheduled_for) 
    WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_scheduled 
    ON sistemaretiradas.whatsapp_message_queue(status, scheduled_for) 
    WHERE status IN ('PENDING', 'SCHEDULED');

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_phone_date 
    ON sistemaretiradas.whatsapp_message_queue(phone, sent_at) 
    WHERE sent_at IS NOT NULL;

-- 3. Garantir colunas em whatsapp_campaigns se necessário
DO $$ 
BEGIN
    -- scheduled_start_at: Data/hora de início agendado da campanha
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_campaigns' 
        AND column_name = 'scheduled_start_at'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_campaigns
        ADD COLUMN scheduled_start_at TIMESTAMPTZ;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.scheduled_start_at IS 
        'Data e hora agendada para início da campanha (NULL = iniciar imediatamente)';
    END IF;

    -- start_hour: Hora inicial permitida para envio (0-23)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_campaigns' 
        AND column_name = 'start_hour'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_campaigns
        ADD COLUMN start_hour INTEGER 
        CHECK (start_hour >= 0 AND start_hour <= 23);
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.start_hour IS 
        'Hora inicial permitida para envio (0-23, NULL = sem restrição)';
    END IF;

    -- end_hour: Hora final permitida para envio (0-23)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_campaigns' 
        AND column_name = 'end_hour'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_campaigns
        ADD COLUMN end_hour INTEGER 
        CHECK (end_hour >= 0 AND end_hour <= 23);
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.end_hour IS 
        'Hora final permitida para envio (0-23, NULL = sem restrição)';
    END IF;

    -- min_interval_minutes: Intervalo mínimo entre mensagens em minutos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_campaigns' 
        AND column_name = 'min_interval_minutes'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_campaigns
        ADD COLUMN min_interval_minutes INTEGER DEFAULT 5;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.min_interval_minutes IS 
        'Intervalo mínimo em minutos entre mensagens da campanha';
    END IF;

    -- daily_limit: Limite diário de mensagens para a campanha
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'whatsapp_campaigns' 
        AND column_name = 'daily_limit'
    ) THEN
        ALTER TABLE sistemaretiradas.whatsapp_campaigns
        ADD COLUMN daily_limit INTEGER;
        
        COMMENT ON COLUMN sistemaretiradas.whatsapp_campaigns.daily_limit IS 
        'Limite diário de mensagens para a campanha (NULL = sem limite)';
    END IF;

END $$;

-- 4. Garantir que a função get_next_whatsapp_messages respeita scheduled_for
-- (A função já deve existir, mas garantimos que está correta)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_whatsapp_messages(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    queue_id UUID,
    phone TEXT,
    message TEXT,
    store_id UUID,
    whatsapp_account_id UUID,
    priority INTEGER,
    message_type TEXT,
    interval_seconds INTEGER,
    campaign_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Belem';
    v_current_hour INTEGER := EXTRACT(HOUR FROM v_now);
BEGIN
    RETURN QUERY
    SELECT 
        q.id AS queue_id,
        q.phone,
        q.message,
        q.store_id,
        q.whatsapp_account_id,
        q.priority,
        q.message_type,
        q.interval_seconds,
        q.campaign_id
    FROM sistemaretiradas.whatsapp_message_queue q
    WHERE q.status IN ('PENDING', 'SCHEDULED')
    -- Respeitar agendamento: se scheduled_for existe, só buscar se já passou
    AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
    -- Respeitar janela de horário permitida
    AND (
        q.allowed_start_hour IS NULL 
        OR (
            q.allowed_start_hour IS NOT NULL 
            AND q.allowed_end_hour IS NOT NULL
            AND v_current_hour >= q.allowed_start_hour 
            AND v_current_hour < q.allowed_end_hour
        )
        OR (
            q.allowed_start_hour IS NOT NULL 
            AND q.allowed_end_hour IS NULL
            AND v_current_hour >= q.allowed_start_hour
        )
    )
    ORDER BY 
        q.priority ASC, -- Menor número = maior prioridade (1-3 crítico, 4-6 normal, 7-10 campanhas)
        q.created_at ASC -- Mais antiga primeiro
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_next_whatsapp_messages IS 
'Busca próximas mensagens respeitando prioridades, agendamento (scheduled_for) e horários permitidos (allowed_start_hour/end_hour)';

-- 5. Comentários finais
COMMENT ON TABLE sistemaretiradas.whatsapp_message_queue IS 
'Fila unificada de mensagens WhatsApp com sistema de prioridades e agendamento. Mensagens críticas (cashback, notificações) têm prioridade sobre campanhas.';

COMMENT ON TABLE sistemaretiradas.whatsapp_campaigns IS 
'Campanhas de envio em massa WhatsApp. Suporta agendamento (scheduled_start_at) e janelas de horário (start_hour/end_hour).';

