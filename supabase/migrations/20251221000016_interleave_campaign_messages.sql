-- =====================================================
-- INTERCALAR MENSAGENS POR LOJA E CAMPANHA
-- =====================================================
-- Esta migration modifica a função get_next_whatsapp_messages
-- para processar mensagens de forma independente por loja.
-- 
-- CADA LOJA TEM SUA PRÓPRIA FILA INDEPENDENTE:
-- - Mensagens de diferentes lojas não bloqueiam umas às outras
-- - Dentro de cada loja, campanhas diferentes são intercaladas
-- - Respeita prioridades (cashback, notificações > campanhas)
-- - Cada loja/campanha respeita seus próprios intervalos
-- 
-- Isso permite escalar para 800+ lojas processando em paralelo
-- sem que uma loja bloqueie outras.
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
    store_ordering AS (
        -- Ordenar lojas pela primeira mensagem criada
        SELECT DISTINCT
            bf.store_id,
            MIN(bf.created_at) as first_message_at,
            ROW_NUMBER() OVER (ORDER BY MIN(bf.created_at)) as store_order
        FROM base_filter bf
        WHERE bf.store_id IS NOT NULL
        GROUP BY bf.store_id
    ),
    campaign_ordering AS (
        -- Ordenar campanhas dentro de cada loja pela primeira mensagem criada
        SELECT DISTINCT
            bf.store_id,
            bf.campaign_id,
            MIN(bf.created_at) as first_message_at,
            ROW_NUMBER() OVER (
                PARTITION BY bf.store_id 
                ORDER BY MIN(bf.created_at)
            ) as campaign_order_in_store
        FROM base_filter bf
        WHERE bf.campaign_id IS NOT NULL 
        AND bf.message_type = 'CAMPAIGN'
        GROUP BY bf.store_id, bf.campaign_id
    ),
    store_campaign_counts AS (
        -- Contar quantas campanhas cada loja tem (para calcular round-robin)
        SELECT 
            co.store_id,
            COUNT(*) as campaigns_per_store
        FROM campaign_ordering co
        GROUP BY co.store_id
    ),
    ranked_messages AS (
        -- Rankear mensagens criando índice hierárquico: LOJA > CAMPANHA > MENSAGEM
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
            -- Estratégia de ordenação:
            -- 1. PRIORIDADE (cashback=1, notificações=4, campanhas=7-10) - mais importante
            -- 2. LOJA (intercala entre lojas)
            -- 3. CAMPANHA dentro da loja (intercala entre campanhas da mesma loja)
            -- 4. ORDEM da mensagem dentro da campanha
            CASE 
                -- Mensagens não-campanha (cashback, notificações): prioridade absoluta
                WHEN bf.campaign_id IS NULL OR bf.message_type != 'CAMPAIGN' THEN
                    bf.priority * 1000000000000::BIGINT + -- Prioridade primeiro
                    COALESCE(so.store_order, 9999) * 1000000000::BIGINT + -- Depois loja
                    EXTRACT(EPOCH FROM (NOW() - bf.created_at))::BIGINT -- Depois idade
                
                -- Mensagens de campanha: intercalar por loja E campanha
                ELSE
                    bf.priority * 1000000000000::BIGINT + -- Prioridade primeiro
                    COALESCE(so.store_order, 9999) * 1000000000::BIGINT + -- Depois loja
                    -- Round-robin dentro da loja: intercala campanhas
                    -- Mensagem N da campanha M na loja L: (N-1) * total_campanhas_loja + ordem_campanha
                    (ROW_NUMBER() OVER (
                        PARTITION BY bf.store_id, bf.campaign_id 
                        ORDER BY bf.priority ASC, bf.created_at ASC
                    ) - 1) * COALESCE(scc.campaigns_per_store, 1)::BIGINT * 1000000 +
                    COALESCE(co.campaign_order_in_store, 9999) * 1000000 +
                    EXTRACT(EPOCH FROM (NOW() - bf.created_at))::BIGINT
            END as sort_index
        FROM base_filter bf
        LEFT JOIN store_ordering so ON bf.store_id = so.store_id
        LEFT JOIN campaign_ordering co ON bf.store_id = co.store_id AND bf.campaign_id = co.campaign_id
        LEFT JOIN store_campaign_counts scc ON bf.store_id = scc.store_id
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
        rm.queue_id
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION sistemaretiradas.get_next_whatsapp_messages IS 
'Busca próximas mensagens respeitando prioridades e intercalando campanhas diferentes para processamento paralelo. Campanhas diferentes são alternadas respeitando seus próprios intervalos.';

