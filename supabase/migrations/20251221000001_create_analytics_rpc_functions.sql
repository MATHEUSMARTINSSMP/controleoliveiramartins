-- ============================================
-- FUNÇÕES RPC PARA ANALYTICS DE CAMPANHAS
-- ============================================
-- Estas funções fornecem acesso completo e organizado aos dados de
-- contacts, sales, campanhas e mensagens para análises profundas
-- ============================================

-- Função 1: Obter estatísticas de performance por categoria de campanha
CREATE OR REPLACE FUNCTION sistemaretiradas.get_campaign_analytics_by_category(
  p_store_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total_campaigns BIGINT,
  total_messages_sent BIGINT,
  total_recipients BIGINT,
  successful_messages BIGINT,
  failed_messages BIGINT,
  conversion_rate NUMERIC,
  avg_days_to_return NUMERIC,
  total_revenue_generated NUMERIC,
  avg_ticket_post_campaign NUMERIC,
  total_sales_count BIGINT,
  roi_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Definir período padrão (últimos 90 dias se não especificado)
  v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '90 days');
  v_end_date := COALESCE(p_end_date, NOW());

  RETURN QUERY
  WITH campaign_stats AS (
    SELECT 
      wc.category,
      COUNT(DISTINCT wc.id) as total_campaigns,
      COUNT(DISTINCT wmq.id) as total_messages_sent,
      COUNT(DISTINCT wmq.phone) as total_recipients,
      COUNT(DISTINCT CASE WHEN wmq.status = 'SENT' THEN wmq.id END) as successful_messages,
      COUNT(DISTINCT CASE WHEN wmq.status = 'FAILED' THEN wmq.id END) as failed_messages
    FROM sistemaretiradas.whatsapp_campaigns wc
    LEFT JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
    WHERE 
      (p_store_id IS NULL OR wc.store_id = p_store_id)
      AND (p_category IS NULL OR wc.category = p_category)
      AND wc.created_at >= v_start_date
      AND wc.created_at <= v_end_date
    GROUP BY wc.category
  ),
  customer_returns AS (
    SELECT 
      wc.category,
      AVG(
        EXTRACT(EPOCH FROM (s.data_venda - wmq.sent_at)) / 86400.0
      ) FILTER (WHERE s.data_venda > wmq.sent_at) as avg_days_to_return,
      COUNT(DISTINCT s.id) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as total_sales_count,
      SUM(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as total_revenue,
      AVG(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as avg_ticket
    FROM sistemaretiradas.whatsapp_campaigns wc
    INNER JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
    INNER JOIN sistemaretiradas.contacts c ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    INNER JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = c.id OR s.cliente_nome ILIKE '%' || c.nome || '%')
      AND s.data_venda > wmq.sent_at
      AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
    )
    WHERE 
      wmq.status = 'SENT'
      AND (p_store_id IS NULL OR wc.store_id = p_store_id)
      AND (p_category IS NULL OR wc.category = p_category)
      AND wc.created_at >= v_start_date
      AND wc.created_at <= v_end_date
    GROUP BY wc.category
  )
  SELECT 
    COALESCE(cs.category, 'OUTROS') as category,
    COALESCE(cs.total_campaigns, 0)::BIGINT,
    COALESCE(cs.total_messages_sent, 0)::BIGINT,
    COALESCE(cs.total_recipients, 0)::BIGINT,
    COALESCE(cs.successful_messages, 0)::BIGINT,
    COALESCE(cs.failed_messages, 0)::BIGINT,
    CASE 
      WHEN cs.total_recipients > 0 THEN 
        ROUND((cr.total_sales_count::NUMERIC / cs.total_recipients::NUMERIC) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    ROUND(COALESCE(cr.avg_days_to_return, 0), 2) as avg_days_to_return,
    COALESCE(cr.total_revenue, 0)::NUMERIC as total_revenue_generated,
    ROUND(COALESCE(cr.avg_ticket, 0), 2) as avg_ticket_post_campaign,
    COALESCE(cr.total_sales_count, 0)::BIGINT,
    CASE 
      WHEN cs.total_messages_sent > 0 THEN 
        ROUND((COALESCE(cr.total_revenue, 0) / cs.total_messages_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as roi_percentage
  FROM campaign_stats cs
  LEFT JOIN customer_returns cr ON cs.category = cr.category
  ORDER BY cs.category;
END;
$$;

-- Função 2: Rastrear retorno de clientes após campanha específica
CREATE OR REPLACE FUNCTION sistemaretiradas.track_customer_return_after_campaign(
  p_campaign_id UUID
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  message_sent_at TIMESTAMPTZ,
  first_sale_after_message TIMESTAMPTZ,
  days_to_return INTEGER,
  total_sales_count BIGINT,
  total_revenue NUMERIC,
  avg_ticket NUMERIC,
  returned BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH campaign_messages AS (
    SELECT DISTINCT
      wmq.phone,
      wmq.sent_at,
      c.id as contact_id,
      c.nome as contact_name,
      c.telefone as contact_phone
    FROM sistemaretiradas.whatsapp_message_queue wmq
    INNER JOIN sistemaretiradas.contacts c ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    WHERE 
      wmq.campaign_id = p_campaign_id
      AND wmq.status = 'SENT'
      AND wmq.sent_at IS NOT NULL
  ),
  customer_sales_after AS (
    SELECT 
      cm.contact_id,
      cm.contact_name,
      cm.contact_phone,
      cm.sent_at,
      MIN(s.data_venda) as first_sale_after_message,
      COUNT(s.id) as total_sales_count,
      SUM(s.valor) as total_revenue,
      AVG(s.valor) as avg_ticket
    FROM campaign_messages cm
    LEFT JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = cm.contact_id OR s.cliente_nome ILIKE '%' || cm.contact_name || '%')
      AND s.data_venda > cm.sent_at
      AND s.data_venda <= cm.sent_at + INTERVAL '90 days'
    )
    GROUP BY cm.contact_id, cm.contact_name, cm.contact_phone, cm.sent_at
  )
  SELECT 
    csa.contact_id,
    csa.contact_name,
    csa.contact_phone,
    csa.sent_at::TIMESTAMPTZ as message_sent_at,
    csa.first_sale_after_message::TIMESTAMPTZ as first_sale_after_message,
    CASE 
      WHEN csa.first_sale_after_message IS NOT NULL THEN
        EXTRACT(EPOCH FROM (csa.first_sale_after_message::TIMESTAMPTZ - csa.sent_at::TIMESTAMPTZ)) / 86400
      ELSE NULL
    END::INTEGER as days_to_return,
    COALESCE(csa.total_sales_count, 0)::BIGINT,
    COALESCE(csa.total_revenue, 0)::NUMERIC,
    ROUND(COALESCE(csa.avg_ticket, 0), 2) as avg_ticket,
    (csa.first_sale_after_message IS NOT NULL) as returned
  FROM customer_sales_after csa
  ORDER BY csa.sent_at DESC, csa.contact_name;
END;
$$;

-- Função 3: Obter métricas detalhadas de uma campanha específica
CREATE OR REPLACE FUNCTION sistemaretiradas.get_campaign_detailed_analytics(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  campaign_category TEXT,
  total_recipients BIGINT,
  messages_sent BIGINT,
  messages_failed BIGINT,
  unique_customers_reached BIGINT,
  customers_who_returned BIGINT,
  conversion_rate NUMERIC,
  avg_days_to_return NUMERIC,
  total_revenue_30_days NUMERIC,
  total_revenue_60_days NUMERIC,
  total_revenue_90_days NUMERIC,
  avg_ticket_30_days NUMERIC,
  avg_ticket_60_days NUMERIC,
  avg_ticket_90_days NUMERIC,
  total_sales_30_days BIGINT,
  total_sales_60_days BIGINT,
  total_sales_90_days BIGINT,
  roi_30_days NUMERIC,
  roi_60_days NUMERIC,
  roi_90_days NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH campaign_info AS (
    SELECT 
      wc.id,
      wc.name,
      wc.category,
      wc.total_recipients,
      COUNT(DISTINCT wmq.id) FILTER (WHERE wmq.status = 'SENT') as messages_sent,
      COUNT(DISTINCT wmq.id) FILTER (WHERE wmq.status = 'FAILED') as messages_failed,
      COUNT(DISTINCT wmq.phone) FILTER (WHERE wmq.status = 'SENT') as unique_customers
    FROM sistemaretiradas.whatsapp_campaigns wc
    LEFT JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
    WHERE wc.id = p_campaign_id
    GROUP BY wc.id, wc.name, wc.category, wc.total_recipients
  ),
  customer_returns AS (
    SELECT 
      COUNT(DISTINCT CASE 
        WHEN s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '30 days' 
        THEN c.id 
      END) as returned_30,
      COUNT(DISTINCT CASE 
        WHEN s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '60 days' 
        THEN c.id 
      END) as returned_60,
      COUNT(DISTINCT CASE 
        WHEN s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '90 days' 
        THEN c.id 
      END) as returned_90,
      SUM(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as revenue_30,
      SUM(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '60 days') as revenue_60,
      SUM(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '90 days') as revenue_90,
      AVG(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as ticket_30,
      AVG(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '60 days') as ticket_60,
      AVG(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '90 days') as ticket_90,
      COUNT(s.id) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '30 days') as sales_30,
      COUNT(s.id) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '60 days') as sales_60,
      COUNT(s.id) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '90 days') as sales_90,
      AVG(EXTRACT(EPOCH FROM (s.data_venda - wmq.sent_at)) / 86400.0) FILTER (WHERE s.data_venda > wmq.sent_at) as avg_days
    FROM sistemaretiradas.whatsapp_message_queue wmq
    INNER JOIN sistemaretiradas.contacts c ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    LEFT JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = c.id OR s.cliente_nome ILIKE '%' || c.nome || '%')
      AND s.data_venda > wmq.sent_at
    )
    WHERE 
      wmq.campaign_id = p_campaign_id
      AND wmq.status = 'SENT'
      AND wmq.sent_at IS NOT NULL
  )
  SELECT 
    ci.id,
    ci.name,
    ci.category,
    ci.total_recipients::BIGINT,
    ci.messages_sent::BIGINT,
    ci.messages_failed::BIGINT,
    ci.unique_customers::BIGINT,
    COALESCE(cr.returned_30, 0)::BIGINT as customers_who_returned,
    CASE 
      WHEN ci.unique_customers > 0 THEN 
        ROUND((COALESCE(cr.returned_30, 0)::NUMERIC / ci.unique_customers::NUMERIC) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    ROUND(COALESCE(cr.avg_days, 0), 2) as avg_days_to_return,
    COALESCE(cr.revenue_30, 0)::NUMERIC,
    COALESCE(cr.revenue_60, 0)::NUMERIC,
    COALESCE(cr.revenue_90, 0)::NUMERIC,
    ROUND(COALESCE(cr.ticket_30, 0), 2),
    ROUND(COALESCE(cr.ticket_60, 0), 2),
    ROUND(COALESCE(cr.ticket_90, 0), 2),
    COALESCE(cr.sales_30, 0)::BIGINT,
    COALESCE(cr.sales_60, 0)::BIGINT,
    COALESCE(cr.sales_90, 0)::BIGINT,
    CASE 
      WHEN ci.messages_sent > 0 THEN 
        ROUND((COALESCE(cr.revenue_30, 0) / ci.messages_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as roi_30_days,
    CASE 
      WHEN ci.messages_sent > 0 THEN 
        ROUND((COALESCE(cr.revenue_60, 0) / ci.messages_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as roi_60_days,
    CASE 
      WHEN ci.messages_sent > 0 THEN 
        ROUND((COALESCE(cr.revenue_90, 0) / ci.messages_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as roi_90_days
  FROM campaign_info ci
  CROSS JOIN customer_returns cr;
END;
$$;

-- Função 4: Obter clientes mais responsivos por categoria
CREATE OR REPLACE FUNCTION sistemaretiradas.get_most_responsive_customers_by_category(
  p_store_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  category TEXT,
  campaigns_received BIGINT,
  times_returned BIGINT,
  total_revenue_generated NUMERIC,
  avg_days_to_return NUMERIC,
  responsiveness_score NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH customer_campaigns AS (
    SELECT 
      c.id as contact_id,
      c.nome as contact_name,
      c.telefone as contact_phone,
      wc.category,
      COUNT(DISTINCT wc.id) as campaigns_received,
      COUNT(DISTINCT CASE 
        WHEN s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '90 days' 
        THEN s.id 
      END) as times_returned,
      SUM(s.valor) FILTER (WHERE s.data_venda > wmq.sent_at AND s.data_venda <= wmq.sent_at + INTERVAL '90 days') as total_revenue,
      AVG(EXTRACT(EPOCH FROM (s.data_venda - wmq.sent_at)) / 86400.0) FILTER (WHERE s.data_venda > wmq.sent_at) as avg_days
    FROM sistemaretiradas.contacts c
    INNER JOIN sistemaretiradas.whatsapp_message_queue wmq ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    INNER JOIN sistemaretiradas.whatsapp_campaigns wc ON wc.id = wmq.campaign_id
    LEFT JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = c.id OR s.cliente_nome ILIKE '%' || c.nome || '%')
      AND s.data_venda > wmq.sent_at
    )
    WHERE 
      wmq.status = 'SENT'
      AND wmq.sent_at IS NOT NULL
      AND (p_store_id IS NULL OR wc.store_id = p_store_id)
      AND (p_category IS NULL OR wc.category = p_category)
    GROUP BY c.id, c.nome, c.telefone, wc.category
  )
  SELECT 
    cc.contact_id,
    cc.contact_name,
    cc.contact_phone,
    cc.category,
    cc.campaigns_received,
    cc.times_returned,
    COALESCE(cc.total_revenue, 0)::NUMERIC,
    ROUND(COALESCE(cc.avg_days, 0), 2) as avg_days_to_return,
    ROUND(
      CASE 
        WHEN cc.campaigns_received > 0 THEN 
          (cc.times_returned::NUMERIC / cc.campaigns_received::NUMERIC) * 100
        ELSE 0 
      END, 2
    ) as responsiveness_score
  FROM customer_campaigns cc
  WHERE cc.times_returned > 0
  ORDER BY responsiveness_score DESC, total_revenue DESC
  LIMIT p_limit;
END;
$$;

-- Comentários de documentação
COMMENT ON FUNCTION sistemaretiradas.get_campaign_analytics_by_category IS 
'Retorna estatísticas agregadas de performance por categoria de campanha, incluindo taxas de conversão, ROI e receita gerada';

COMMENT ON FUNCTION sistemaretiradas.track_customer_return_after_campaign IS 
'Rastreia o retorno de cada cliente após receber mensagens de uma campanha específica, incluindo tempo até primeira venda e receita gerada';

COMMENT ON FUNCTION sistemaretiradas.get_campaign_detailed_analytics IS 
'Fornece métricas detalhadas de uma campanha específica, incluindo ROI em diferentes períodos (30, 60, 90 dias)';

COMMENT ON FUNCTION sistemaretiradas.get_most_responsive_customers_by_category IS 
'Identifica os clientes mais responsivos a cada categoria de campanha, calculando score de responsividade baseado em taxa de retorno';

