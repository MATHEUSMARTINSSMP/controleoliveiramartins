-- ============================================================================
-- MIGRATION: Sistema de Fila de WhatsApp com Prioridades
-- Data: 2025-12-19
-- Descrição: Cria tabela de fila unificada com prioridades para campanhas
--            não bloquearem outras mensagens (cashback, notificações, etc)
-- ============================================================================

-- Tabela unificada de fila de WhatsApp com prioridades
CREATE TABLE IF NOT EXISTS sistemaretiradas.whatsapp_message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Informações da mensagem
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Prioridade (1 = mais alta, 10 = mais baixa)
    -- 1-3: Crítico (cashback, notificações urgentes)
    -- 4-6: Normal (notificações, avisos de ponto)
    -- 7-10: Campanhas (envio em massa)
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    
    -- Tipo de mensagem (para rastreamento)
    message_type TEXT NOT NULL CHECK (message_type IN (
        'CASHBACK',
        'NOTIFICATION',
        'POINT_CLOCK',
        'CAMPAIGN',
        'OTHER'
    )),
    
    -- Referência a campanha (se aplicável)
    campaign_id UUID REFERENCES sistemaretiradas.whatsapp_campaigns(id) ON DELETE SET NULL,
    campaign_message_id UUID REFERENCES sistemaretiradas.whatsapp_campaign_messages(id) ON DELETE SET NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'SCHEDULED',
        'SENDING',
        'SENT',
        'FAILED',
        'CANCELLED'
    )),
    
    -- Agendamento
    scheduled_for TIMESTAMPTZ,
    
    -- Controle de horário permitido
    allowed_start_hour INTEGER CHECK (allowed_start_hour >= 0 AND allowed_start_hour <= 23),
    allowed_end_hour INTEGER CHECK (allowed_end_hour >= 0 AND allowed_end_hour <= 23),
    
    -- Limites por número
    whatsapp_account_id UUID REFERENCES sistemaretiradas.whatsapp_accounts(id) ON DELETE SET NULL,
    max_per_day_per_contact INTEGER DEFAULT 1, -- Máximo de mensagens por contato por dia
    max_total_per_day INTEGER, -- Máximo total de mensagens por dia (soma de todos os números)
    
    -- Intervalo entre mensagens (em segundos)
    interval_seconds INTEGER DEFAULT 0,
    
    -- Resultado
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_priority 
    ON sistemaretiradas.whatsapp_message_queue(status, priority, scheduled_for) 
    WHERE status IN ('PENDING', 'SCHEDULED');

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_store 
    ON sistemaretiradas.whatsapp_message_queue(store_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_campaign 
    ON sistemaretiradas.whatsapp_message_queue(campaign_id) 
    WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_phone 
    ON sistemaretiradas.whatsapp_message_queue(phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_scheduled 
    ON sistemaretiradas.whatsapp_message_queue(scheduled_for) 
    WHERE status = 'SCHEDULED';

-- RLS
ALTER TABLE sistemaretiradas.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver fila de suas lojas"
ON sistemaretiradas.whatsapp_message_queue
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.stores s
        WHERE s.id = whatsapp_message_queue.store_id
        AND s.admin_id = auth.uid()
    )
);

CREATE POLICY "Service role pode gerenciar fila"
ON sistemaretiradas.whatsapp_message_queue
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Função para buscar próximas mensagens respeitando prioridades
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
    AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
    AND (
        q.allowed_start_hour IS NULL 
        OR (v_current_hour >= q.allowed_start_hour AND v_current_hour < q.allowed_end_hour)
    )
    ORDER BY 
        q.priority ASC, -- Menor número = maior prioridade
        q.created_at ASC -- Mais antiga primeiro
    LIMIT p_limit;
END;
$$;

-- Função para incrementar contador de mensagens enviadas da campanha
CREATE OR REPLACE FUNCTION sistemaretiradas.increment_campaign_sent_count(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sistemaretiradas.whatsapp_campaigns
    SET sent_count = COALESCE(sent_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
END;
$$;

COMMENT ON TABLE sistemaretiradas.whatsapp_message_queue IS 'Fila unificada de mensagens WhatsApp com sistema de prioridades';
COMMENT ON COLUMN sistemaretiradas.whatsapp_message_queue.priority IS 'Prioridade: 1-3 crítico, 4-6 normal, 7-10 campanhas';
COMMENT ON FUNCTION sistemaretiradas.get_next_whatsapp_messages IS 'Busca próximas mensagens respeitando prioridades e horários permitidos';
COMMENT ON FUNCTION sistemaretiradas.increment_campaign_sent_count IS 'Incrementa contador de mensagens enviadas de uma campanha';

