-- =====================================================
-- APENAS FUNÇÕES - Execute direto no SQL Editor do Supabase
-- Use este arquivo se as tabelas e policies já existem
-- =====================================================

-- FUNÇÃO: Calcular risco dinamicamente
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_campaign_risk(
    p_daily_limit INTEGER,
    p_min_interval INTEGER,
    p_use_rotation BOOLEAN,
    p_total_recipients INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_risk_score INTEGER := 0;
BEGIN
    IF p_min_interval <= 1 THEN
        v_risk_score := v_risk_score + 3;
    ELSIF p_min_interval <= 3 THEN
        v_risk_score := v_risk_score + 2;
    ELSE
        v_risk_score := v_risk_score + 1;
    END IF;
    
    IF p_daily_limit > 100 THEN
        v_risk_score := v_risk_score + 3;
    ELSIF p_daily_limit > 50 THEN
        v_risk_score := v_risk_score + 2;
    ELSE
        v_risk_score := v_risk_score + 1;
    END IF;
    
    IF p_use_rotation THEN
        v_risk_score := v_risk_score - 1;
    END IF;
    
    IF v_risk_score >= 5 THEN
        RETURN 'HIGH';
    ELSIF v_risk_score >= 3 THEN
        RETURN 'MEDIUM';
    ELSE
        RETURN 'LOW';
    END IF;
END;
$$;

-- FUNÇÃO: Buscar próximas mensagens para envio
CREATE OR REPLACE FUNCTION sistemaretiradas.get_next_campaign_messages(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    message_id UUID,
    campaign_id UUID,
    phone TEXT,
    message_content TEXT,
    store_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Belem';
    v_current_hour INTEGER := EXTRACT(HOUR FROM v_now);
    v_current_day TEXT := TO_CHAR(v_now, 'DY');
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS message_id,
        m.campaign_id,
        m.phone,
        m.message_content,
        c.store_id
    FROM sistemaretiradas.whatsapp_campaign_messages m
    JOIN sistemaretiradas.whatsapp_campaigns c ON m.campaign_id = c.id
    WHERE m.status = 'SCHEDULED'
    AND c.status = 'RUNNING'
    AND m.scheduled_for <= NOW()
    AND v_current_hour >= c.start_hour
    AND v_current_hour < c.end_hour
    AND v_current_day = ANY(c.active_days)
    ORDER BY m.scheduled_for ASC
    LIMIT p_limit;
END;
$$;

-- FUNÇÃO: Estatísticas CRM para filtros (usa tabela SALES unificada)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_crm_customer_stats(
    p_store_id UUID
)
RETURNS TABLE (
    contact_id UUID,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    ultima_compra DATE,
    dias_sem_comprar INTEGER,
    total_compras NUMERIC,
    quantidade_compras INTEGER,
    ticket_medio NUMERIC,
    categoria TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_sales AS (
        SELECT 
            s.cliente_id,
            MAX(s.data_venda::DATE) AS ultima_compra,
            SUM(COALESCE(s.valor, 0)) AS total_compras,
            COUNT(*) AS quantidade_compras
        FROM sistemaretiradas.sales s
        WHERE s.store_id = p_store_id
        AND s.cliente_id IS NOT NULL
        GROUP BY s.cliente_id
    )
    SELECT 
        c.id AS contact_id,
        c.nome,
        COALESCE(c.telefone, c.celular) AS telefone,
        c.email,
        c.cpf,
        cs.ultima_compra,
        COALESCE((CURRENT_DATE - cs.ultima_compra), 9999)::INTEGER AS dias_sem_comprar,
        COALESCE(cs.total_compras, 0) AS total_compras,
        COALESCE(cs.quantidade_compras::INTEGER, 0) AS quantidade_compras,
        CASE WHEN cs.quantidade_compras > 0 
            THEN ROUND(cs.total_compras / cs.quantidade_compras, 2) 
            ELSE 0 
        END AS ticket_medio,
        CASE 
            WHEN cs.total_compras >= 5000 THEN 'BLACK'
            WHEN cs.total_compras >= 2000 THEN 'PLATINUM'
            WHEN cs.total_compras >= 500 THEN 'VIP'
            ELSE 'REGULAR'
        END AS categoria
    FROM sistemaretiradas.crm_contacts c
    LEFT JOIN customer_sales cs ON c.id = cs.cliente_id
    WHERE c.store_id = p_store_id
    AND (c.telefone IS NOT NULL OR c.celular IS NOT NULL);
END;
$$;
