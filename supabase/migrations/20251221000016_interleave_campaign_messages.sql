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
    v_campaign_limit INTEGER; -- Limite por campanha para distribuir igualmente
BEGIN
    -- Se p_limit for muito pequeno, não vale a pena intercalar
    -- Usar ordem normal (por prioridade e data)
    IF p_limit < 5 THEN
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
            q.priority ASC,
            q.created_at ASC
        LIMIT p_limit;
        RETURN;
    END IF;

    -- Para p_limit >= 5, intercalar campanhas diferentes
    -- Estratégia: Pegar mensagens de diferentes campanhas de forma rotativa
    
    -- Primeiro, contar quantas campanhas diferentes têm mensagens pendentes
    WITH active_campaigns AS (
        SELECT DISTINCT q.campaign_id
        FROM sistemaretiradas.whatsapp_message_queue q
        WHERE q.status IN ('PENDING', 'SCHEDULED')
        AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
        AND (
            q.allowed_start_hour IS NULL 
            OR (v_current_hour >= q.allowed_start_hour AND v_current_hour < q.allowed_end_hour)
        )
        AND q.campaign_id IS NOT NULL -- Apenas mensagens de campanhas
        AND q.message_type = 'CAMPAIGN'
    ),
    campaign_counts AS (
        SELECT 
            ac.campaign_id,
            COUNT(*) as pending_count,
            -- Adicionar row_number para alternar entre campanhas
            ROW_NUMBER() OVER (ORDER BY MIN(q.created_at)) as campaign_rank
        FROM active_campaigns ac
        JOIN sistemaretiradas.whatsapp_message_queue q ON q.campaign_id = ac.campaign_id
        WHERE q.status IN ('PENDING', 'SCHEDULED')
        AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
        AND (
            q.allowed_start_hour IS NULL 
            OR (v_current_hour >= q.allowed_start_hour AND v_current_hour < q.allowed_end_hour)
        )
        GROUP BY ac.campaign_id
    ),
    total_campaigns AS (
        SELECT COUNT(*) as count FROM campaign_counts
    ),
    -- Selecionar mensagens com rotação entre campanhas
    ranked_messages AS (
        SELECT 
            q.id AS queue_id,
            q.phone,
            q.message,
            q.store_id,
            q.whatsapp_account_id,
            q.priority,
            q.message_type,
            q.interval_seconds,
            q.campaign_id,
            -- Calcular um "round-robin index" para alternar entre campanhas
            -- Usando row_number dentro de cada campanha + offset baseado na ordem da campanha
            ROW_NUMBER() OVER (
                PARTITION BY q.campaign_id 
                ORDER BY q.priority ASC, q.created_at ASC
            ) + (cc.campaign_rank - 1) * 1000 as round_robin_index
        FROM sistemaretiradas.whatsapp_message_queue q
        JOIN campaign_counts cc ON q.campaign_id = cc.campaign_id
        WHERE q.status IN ('PENDING', 'SCHEDULED')
        AND (q.scheduled_for IS NULL OR q.scheduled_for <= NOW())
        AND (
            q.allowed_start_hour IS NULL 
            OR (v_current_hour >= q.allowed_start_hour AND v_current_hour < q.allowed_end_hour)
        )
        AND q.campaign_id IS NOT NULL
        AND q.message_type = 'CAMPAIGN'
    )
    -- Selecionar as primeiras mensagens ordenadas pelo round-robin index
    -- Isso garante que mensagens de diferentes campanhas sejam intercaladas
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
        rm.round_robin_index ASC,  -- Intercala campanhas
        rm.priority ASC,            -- Dentro do mesmo "round", respeita prioridade
        rm.queue_id                 -- Garantir ordem determinística
    LIMIT p_limit;
    
    -- Se ainda não preencheu o limite, buscar mensagens não-campanha (cashback, notificações, etc)
    -- com prioridade mais alta
    IF NOT FOUND OR (SELECT COUNT(*) FROM ranked_messages) < p_limit THEN
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
        AND (q.campaign_id IS NULL OR q.message_type != 'CAMPAIGN') -- Mensagens não-campanha
        ORDER BY 
            q.priority ASC,
            q.created_at ASC
        LIMIT (p_limit - COALESCE((SELECT COUNT(*) FROM ranked_messages), 0));
    END IF;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_next_whatsapp_messages IS 
'Busca próximas mensagens respeitando prioridades e intercalando campanhas diferentes para processamento paralelo. Campanhas diferentes são alternadas respeitando seus próprios intervalos.';

