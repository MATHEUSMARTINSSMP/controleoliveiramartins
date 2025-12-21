-- =====================================================
-- INTERCALAR MENSAGENS DE CAMPANHAS DIFERENTES
-- =====================================================
-- Esta migration modifica a função get_next_whatsapp_messages
-- para processar campanhas diferentes em paralelo (intercaladas),
-- respeitando os intervalos de cada campanha individualmente.
-- 
-- Agora campanhas diferentes (que usam números WhatsApp diferentes)
-- podem rodar simultaneamente, alternando mensagens entre elas.
-- =====================================================

-- Nova função que intercala mensagens de diferentes campanhas
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
    WITH base_filter AS (
        -- Base: mensagens que atendem os critérios básicos
        SELECT 
            q.id,
            q.phone,
            q.message,
            q.store_id,
            q.whatsapp_account_id,
            q.priority,
            q.message_type,
            q.interval_seconds,
            q.campaign_id,
            q.created_at
        FROM sistemaretiradas.whatsapp_message_queue q
        WHERE q.status IN ('PENDING', 'SCHEDULED')
        AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
        AND (
            q.allowed_start_hour IS NULL 
            OR (v_current_hour >= q.allowed_start_hour AND v_current_hour < q.allowed_end_hour)
        )
    ),
    campaign_ordering AS (
        -- Ordenar campanhas pela primeira mensagem criada (para alternar corretamente)
        SELECT DISTINCT
            bf.campaign_id,
            MIN(bf.created_at) as first_message_at,
            ROW_NUMBER() OVER (ORDER BY MIN(bf.created_at)) as campaign_order
        FROM base_filter bf
        WHERE bf.campaign_id IS NOT NULL 
        AND bf.message_type = 'CAMPAIGN'
        GROUP BY bf.campaign_id
    ),
    ranked_messages AS (
        -- Rankear mensagens dentro de cada campanha e criar índice de round-robin
        SELECT 
            bf.id AS queue_id,
            bf.phone,
            bf.message,
            bf.store_id,
            bf.whatsapp_account_id,
            bf.priority,
            bf.message_type,
            bf.interval_seconds,
            bf.campaign_id,
            -- Round-robin: mensagem N da campanha M vai ter índice = (N-1) * total_campaigns + M
            -- Isso garante intercalação: campanha1-msg1, campanha2-msg1, campanha1-msg2, campanha2-msg2, ...
            CASE 
                WHEN bf.campaign_id IS NOT NULL AND bf.message_type = 'CAMPAIGN' THEN
                    (ROW_NUMBER() OVER (
                        PARTITION BY bf.campaign_id 
                        ORDER BY bf.priority ASC, bf.created_at ASC
                    ) - 1) * (SELECT COUNT(*) FROM campaign_ordering) + COALESCE(co.campaign_order, 9999)
                ELSE
                    bf.priority * 1000000 + EXTRACT(EPOCH FROM (NOW() - bf.created_at))::BIGINT
            END as sort_index
        FROM base_filter bf
        LEFT JOIN campaign_ordering co ON bf.campaign_id = co.campaign_id
    )
    SELECT 
        rm.queue_id,
        rm.phone,
        rm.message,
        rm.store_id,
        rm.whatsapp_account_id,
        rm.priority,
        rm.message_type,
        rm.interval_seconds,
        rm.campaign_id
    FROM ranked_messages rm
    ORDER BY 
        rm.sort_index ASC,
        rm.priority ASC,
        rm.queue_id
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_next_whatsapp_messages IS 
'Busca próximas mensagens respeitando prioridades e intercalando campanhas diferentes para processamento paralelo. Campanhas diferentes são alternadas respeitando seus próprios intervalos.';

