-- RPCs para cálculos de performance e metas
-- Estas funções centralizam a lógica de cálculo no banco de dados

-- 1. Função para calcular déficit acumulado de uma colaboradora
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_goal_deficit(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_mes_referencia TEXT
)
RETURNS TABLE (
    deficit DECIMAL(10,2),
    meta_esperada_acumulada DECIMAL(10,2),
    vendido_acumulado DECIMAL(10,2),
    dia_atual INTEGER,
    dias_restantes INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal RECORD;
    v_dia_atual INTEGER;
    v_total_dias INTEGER;
    v_meta_esperada DECIMAL(10,2) := 0;
    v_vendido_acumulado DECIMAL(10,2) := 0;
    v_daily_weights JSONB;
    v_date_key TEXT;
    v_peso DECIMAL(10,4);
BEGIN
    -- Buscar meta individual
    SELECT g.*, 
           EXTRACT(DAY FROM CURRENT_DATE)::INTEGER as current_day,
           EXTRACT(DAY FROM (DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM')) + INTERVAL '1 month - 1 day'))::INTEGER as total_days
    INTO v_goal
    FROM sistemaretiradas.goals g
    WHERE g.colaboradora_id = p_colaboradora_id
      AND g.store_id = p_store_id
      AND g.mes_referencia = p_mes_referencia
      AND g.tipo = 'INDIVIDUAL'
    LIMIT 1;

    IF v_goal IS NULL THEN
        RETURN;
    END IF;

    v_dia_atual := EXTRACT(DAY FROM CURRENT_DATE)::INTEGER;
    v_total_dias := EXTRACT(DAY FROM (DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM')) + INTERVAL '1 month - 1 day'))::INTEGER;
    v_daily_weights := COALESCE(v_goal.daily_weights, '{}'::JSONB);

    -- Calcular meta esperada acumulada até hoje (considerando daily_weights)
    IF jsonb_object_keys(v_daily_weights) IS NOT NULL THEN
        -- Se tem daily_weights, somar até hoje
        FOR v_date_key IN 
            SELECT key FROM jsonb_object_keys(v_daily_weights) key
            WHERE TO_DATE(key::TEXT, 'YYYY-MM-DD') <= CURRENT_DATE
              AND TO_DATE(key::TEXT, 'YYYY-MM-DD') >= DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM'))
        LOOP
            v_peso := (v_daily_weights->>v_date_key)::DECIMAL;
            v_meta_esperada := v_meta_esperada + (v_goal.meta_valor * v_peso / 100);
        END LOOP;
    ELSE
        -- Distribuição simples (mesmo valor por dia)
        v_meta_esperada := (v_goal.meta_valor / v_total_dias) * v_dia_atual;
    END IF;

    -- Calcular vendido acumulado até ontem
    SELECT COALESCE(SUM(s.valor), 0)
    INTO v_vendido_acumulado
    FROM sistemaretiradas.sales s
    WHERE s.colaboradora_id = p_colaboradora_id
      AND DATE_TRUNC('month', s.data_venda) = DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM'))
      AND s.data_venda < DATE_TRUNC('day', CURRENT_DATE);

    RETURN QUERY SELECT 
        v_meta_esperada - v_vendido_acumulado as deficit,
        v_meta_esperada as meta_esperada_acumulada,
        v_vendido_acumulado as vendido_acumulado,
        v_dia_atual as dia_atual,
        v_total_dias - v_dia_atual as dias_restantes;
END;
$$;

-- 2. Função para calcular projeção mensal
CREATE OR REPLACE FUNCTION sistemaretiradas.calculate_monthly_projection(
    p_colaboradora_id UUID,
    p_store_id UUID,
    p_mes_referencia TEXT
)
RETURNS TABLE (
    projecao_mensal DECIMAL(10,2),
    media_diaria DECIMAL(10,2),
    dias_decorridos INTEGER,
    total_dias INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_dias INTEGER;
    v_dia_atual INTEGER;
    v_realizado_mensal DECIMAL(10,2) := 0;
    v_media_diaria DECIMAL(10,2) := 0;
BEGIN
    v_dia_atual := EXTRACT(DAY FROM CURRENT_DATE)::INTEGER;
    v_total_dias := EXTRACT(DAY FROM (DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM')) + INTERVAL '1 month - 1 day'))::INTEGER;

    -- Calcular realizado mensal
    SELECT COALESCE(SUM(s.valor), 0)
    INTO v_realizado_mensal
    FROM sistemaretiradas.sales s
    WHERE s.colaboradora_id = p_colaboradora_id
      AND DATE_TRUNC('month', s.data_venda) = DATE_TRUNC('month', TO_DATE(p_mes_referencia, 'YYYYMM'));

    -- Calcular média diária
    IF v_dia_atual > 0 THEN
        v_media_diaria := v_realizado_mensal / v_dia_atual;
    END IF;

    RETURN QUERY SELECT 
        v_media_diaria * v_total_dias as projecao_mensal,
        v_media_diaria as media_diaria,
        v_dia_atual as dias_decorridos,
        v_total_dias as total_dias;
END;
$$;

-- 3. Função para buscar analytics agregados por loja (otimizada)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_store_analytics(
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS TABLE (
    store_id UUID,
    store_name TEXT,
    total_vendas BIGINT,
    total_valor DECIMAL(10,2),
    total_pecas BIGINT,
    ticket_medio DECIMAL(10,2),
    pa DECIMAL(10,2),
    preco_medio DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        adp.store_id,
        adp.store_name,
        SUM(adp.total_vendas)::BIGINT as total_vendas,
        SUM(adp.total_valor)::DECIMAL(10,2) as total_valor,
        SUM(adp.total_pecas)::BIGINT as total_pecas,
        CASE 
            WHEN SUM(adp.total_vendas) > 0 
            THEN SUM(adp.total_valor) / SUM(adp.total_vendas)
            ELSE 0 
        END::DECIMAL(10,2) as ticket_medio,
        CASE 
            WHEN SUM(adp.total_vendas) > 0 
            THEN SUM(adp.total_pecas)::DECIMAL / SUM(adp.total_vendas)
            ELSE 0 
        END::DECIMAL(10,2) as pa,
        CASE 
            WHEN SUM(adp.total_pecas) > 0 
            THEN SUM(adp.total_valor) / SUM(adp.total_pecas)
            ELSE 0 
        END::DECIMAL(10,2) as preco_medio
    FROM sistemaretiradas.analytics_daily_performance adp
    WHERE adp.data_referencia >= p_data_inicio
      AND adp.data_referencia <= p_data_fim
    GROUP BY adp.store_id, adp.store_name;
END;
$$;

-- Comentários nas funções
COMMENT ON FUNCTION sistemaretiradas.calculate_goal_deficit IS 'Calcula déficit acumulado de metas considerando daily_weights';
COMMENT ON FUNCTION sistemaretiradas.calculate_monthly_projection IS 'Calcula projeção mensal baseada na média diária até o momento';
COMMENT ON FUNCTION sistemaretiradas.get_store_analytics IS 'Retorna analytics agregados por loja para um período específico';

