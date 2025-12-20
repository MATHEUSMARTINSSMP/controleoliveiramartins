-- Função RPC para recomendar melhor categoria de campanha para um cliente
-- Baseado no histórico de responsividade do cliente a diferentes categorias
CREATE OR REPLACE FUNCTION sistemaretiradas.get_campaign_recommendation_for_customer(
  p_contact_id UUID,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  recommended_category TEXT,
  recommendation_score NUMERIC,
  reason TEXT,
  alternative_categories JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Determinar store_id (do contato ou fornecido)
  SELECT store_id INTO v_store_id
  FROM sistemaretiradas.crm_contacts
  WHERE id = p_contact_id;
  
  IF p_store_id IS NOT NULL THEN
    v_store_id := p_store_id;
  END IF;

  RETURN QUERY
  WITH customer_responsiveness AS (
    -- Calcular responsividade do cliente a cada categoria
    SELECT 
      wc.category,
      COUNT(DISTINCT wc.id) as campaigns_received,
      COUNT(DISTINCT CASE 
        WHEN s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
        THEN s.id 
      END) as times_returned,
      SUM(s.valor) FILTER (
        WHERE s.data_venda > wmq.sent_at 
        AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
      ) as total_revenue,
      AVG(EXTRACT(EPOCH FROM (s.data_venda - wmq.sent_at)) / 86400.0) 
        FILTER (WHERE s.data_venda > wmq.sent_at) as avg_days_to_return,
      CASE 
        WHEN COUNT(DISTINCT wc.id) > 0 THEN
          (COUNT(DISTINCT CASE 
            WHEN s.data_venda > wmq.sent_at 
            AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
            THEN s.id 
          END)::NUMERIC / COUNT(DISTINCT wc.id)::NUMERIC) * 100
        ELSE 0
      END as responsiveness_score
    FROM sistemaretiradas.whatsapp_campaigns wc
    INNER JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
    INNER JOIN sistemaretiradas.crm_contacts c ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    LEFT JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = c.id OR s.cliente_nome ILIKE '%' || c.nome || '%')
      AND s.data_venda > wmq.sent_at
      AND s.data_venda <= wmq.sent_at + INTERVAL '90 days'
    )
    WHERE 
      c.id = p_contact_id
      AND wmq.status = 'SENT'
      AND (v_store_id IS NULL OR wc.store_id = v_store_id)
    GROUP BY wc.category
  ),
  category_performance_avg AS (
    -- Performance média da categoria na loja (para clientes sem histórico)
    SELECT 
      wc.category,
      AVG(
        CASE 
          WHEN COUNT(DISTINCT c.id) > 0 THEN
            (COUNT(DISTINCT CASE 
              WHEN s.data_venda > wmq.sent_at 
              AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
              THEN c.id 
            END)::NUMERIC / COUNT(DISTINCT c.id)::NUMERIC) * 100
          ELSE 0
        END
      ) as avg_conversion_rate,
      AVG(
        CASE 
          WHEN COUNT(DISTINCT wmq.id) > 0 THEN
            SUM(s.valor) FILTER (
              WHERE s.data_venda > wmq.sent_at 
              AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
            ) / COUNT(DISTINCT wmq.id)::NUMERIC
          ELSE 0
        END
      ) as avg_revenue_per_message
    FROM sistemaretiradas.whatsapp_campaigns wc
    INNER JOIN sistemaretiradas.whatsapp_message_queue wmq ON wmq.campaign_id = wc.id
    INNER JOIN sistemaretiradas.crm_contacts c ON c.telefone = REPLACE(REPLACE(REPLACE(REPLACE(wmq.phone, '(', ''), ')', ''), '-', ''), ' ', '')
    LEFT JOIN sistemaretiradas.sales s ON (
      (s.cliente_id = c.id OR s.cliente_nome ILIKE '%' || c.nome || '%')
      AND s.data_venda > wmq.sent_at
      AND s.data_venda <= wmq.sent_at + INTERVAL '30 days'
    )
    WHERE 
      (v_store_id IS NULL OR wc.store_id = v_store_id)
      AND wmq.status = 'SENT'
      AND wc.created_at >= NOW() - INTERVAL '6 months'
    GROUP BY wc.category, wc.id
  ),
  category_performance AS (
    SELECT 
      category,
      AVG(avg_conversion_rate) as avg_conversion_rate,
      AVG(avg_revenue_per_message) as avg_revenue_per_message
    FROM category_performance_avg
    GROUP BY category
  ),
  customer_info AS (
    SELECT 
      c.id,
      c.nome,
      c.telefone
    FROM sistemaretiradas.crm_contacts c
    WHERE c.id = p_contact_id
  ),
  best_category AS (
    SELECT 
      ci.id as contact_id,
      ci.nome as contact_name,
      ci.telefone as contact_phone,
      COALESCE(cr.category, cp.category) as recommended_category,
      COALESCE(
        cr.responsiveness_score,
        cp.avg_conversion_rate,
        0
      ) as recommendation_score,
      CASE 
        WHEN cr.campaigns_received > 0 THEN
          'Baseado no histórico: ' || cr.campaigns_received || ' campanha(s) recebida(s), ' || 
          cr.times_returned || ' retorno(s) (' || ROUND(cr.responsiveness_score, 1) || '% de responsividade). ' ||
          CASE 
            WHEN cr.total_revenue > 0 THEN 'Receita gerada: R$ ' || ROUND(cr.total_revenue, 2)
            ELSE 'Ainda não gerou receita'
          END
        WHEN cp.avg_conversion_rate > 0 THEN
          'Baseado na performance média da categoria na loja: ' || 
          ROUND(cp.avg_conversion_rate, 1) || '% de conversão média'
        ELSE
          'Categoria recomendada baseada em padrões gerais'
      END as reason,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'category', COALESCE(cr2.category, cp2.category),
            'score', COALESCE(cr2.responsiveness_score, cp2.avg_conversion_rate, 0),
            'campaigns_received', COALESCE(cr2.campaigns_received, 0),
            'times_returned', COALESCE(cr2.times_returned, 0)
          ) ORDER BY COALESCE(cr2.responsiveness_score, cp2.avg_conversion_rate, 0) DESC
        )
        FROM (
          SELECT DISTINCT category, responsiveness_score, campaigns_received, times_returned
          FROM customer_responsiveness
          UNION
          SELECT DISTINCT category, avg_conversion_rate, 0, 0
          FROM category_performance
          WHERE category NOT IN (SELECT category FROM customer_responsiveness)
        ) cr2
        LEFT JOIN category_performance cp2 ON cp2.category = COALESCE(cr2.category, '')
        WHERE COALESCE(cr2.category, cp2.category) != COALESCE(cr.category, cp.category)
        LIMIT 5
      ) as alternative_categories
    FROM customer_info ci
    LEFT JOIN customer_responsiveness cr ON true
    LEFT JOIN category_performance cp ON cp.category = cr.category OR cr.category IS NULL
    ORDER BY 
      COALESCE(cr.responsiveness_score, cp.avg_conversion_rate, 0) DESC,
      COALESCE(cr.total_revenue, cp.avg_revenue_per_message, 0) DESC
    LIMIT 1
  )
  SELECT * FROM best_category;
END;
$$;

-- Função para recomendar categoria para múltiplos clientes
CREATE OR REPLACE FUNCTION sistemaretiradas.get_bulk_campaign_recommendations(
  p_store_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  recommended_category TEXT,
  recommendation_score NUMERIC,
  reason TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH active_contacts AS (
    SELECT id, nome, telefone
    FROM sistemaretiradas.crm_contacts
    WHERE 
      store_id = p_store_id
      AND telefone IS NOT NULL
      AND telefone != ''
    LIMIT p_limit
  )
  SELECT 
    r.contact_id,
    r.contact_name,
    r.contact_phone,
    r.recommended_category,
    r.recommendation_score,
    r.reason
  FROM active_contacts ac
  CROSS JOIN LATERAL sistemaretiradas.get_campaign_recommendation_for_customer(ac.id, p_store_id) r;
END;
$$;

-- Comentários
COMMENT ON FUNCTION sistemaretiradas.get_campaign_recommendation_for_customer IS 
'Recomenda a melhor categoria de campanha para um cliente específico baseado no histórico de responsividade e performance média das categorias';

COMMENT ON FUNCTION sistemaretiradas.get_bulk_campaign_recommendations IS 
'Retorna recomendações de categoria de campanha para múltiplos clientes de uma loja, útil para planejamento de campanhas segmentadas';

