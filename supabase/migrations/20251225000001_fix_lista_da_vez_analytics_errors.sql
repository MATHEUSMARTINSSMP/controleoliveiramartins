-- ============================================================================
-- MIGRATION: Corrigir erros nas funções de analytics da Lista da Vez
-- ============================================================================
-- Data: 2025-12-25
-- Descrição: Corrige 3 erros nas funções SQL:
--            1. Ambiguidade de store_id em get_store_detailed_metrics
--            2. Tipo de retorno character varying vs text em get_loss_reasons_analytics
--            3. Coluna cs.conversion_rate inexistente em get_collaborators_ranking
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR get_store_detailed_metrics - Ambiguidade de store_id
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_store_detailed_metrics(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    store_id UUID,
    store_name TEXT,
    total_attendances BIGINT,
    total_sales BIGINT,
    total_losses BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_sale_value DECIMAL,
    avg_attendance_duration INTEGER,
    total_attendance_time INTEGER,
    active_collaborators BIGINT,
    total_queue_time INTEGER,
    avg_queue_time INTEGER,
    peak_hour INTEGER,
    peak_hour_attendances BIGINT,
    best_day DATE,
    best_day_attendances BIGINT,
    best_day_sales BIGINT,
    worst_day DATE,
    worst_day_attendances BIGINT,
    worst_day_sales BIGINT,
    top_collaborator_id UUID,
    top_collaborator_name TEXT,
    top_collaborator_sales BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            a.store_id,
            COUNT(DISTINCT a.id) as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as total_sales,
            COUNT(DISTINCT CASE WHEN ao.result = 'perda' THEN a.id END) as total_losses,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(CASE WHEN ao.result = 'venda' THEN ao.sale_value END), 0) as avg_sale_value,
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration,
            COALESCE(SUM(a.duration_seconds), 0)::INTEGER as total_time,
            COUNT(DISTINCT a.profile_id) as active_collaborators
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.store_id
    ),
    queue_stats AS (
        SELECT 
            qs.store_id,
            COALESCE(SUM(
                EXTRACT(EPOCH FROM (
                    COALESCE(a.started_at, NOW()) - qm.check_in_at
                ))
            ), 0)::INTEGER as total_queue_time,
            COALESCE(AVG(
                EXTRACT(EPOCH FROM (
                    COALESCE(a.started_at, NOW()) - qm.check_in_at
                ))
            ), 0)::INTEGER as avg_queue_time
        FROM sistemaretiradas.queue_sessions qs
        JOIN sistemaretiradas.queue_members qm ON qm.session_id = qs.id
        LEFT JOIN sistemaretiradas.attendances a ON a.profile_id = qm.profile_id 
            AND a.session_id = qm.session_id
            AND a.started_at >= qm.check_in_at
        WHERE qs.store_id = p_store_id
          AND DATE(qm.check_in_at) BETWEEN p_start_date AND p_end_date
        GROUP BY qs.store_id
    ),
    hourly_stats AS (
        SELECT 
            a.store_id,
            EXTRACT(HOUR FROM a.started_at)::INTEGER as hour,
            COUNT(DISTINCT a.id) as hour_attendances
        FROM sistemaretiradas.attendances a
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.store_id, EXTRACT(HOUR FROM a.started_at)
    ),
    peak_hour_data AS (
        SELECT 
            store_id,
            hour as peak_hour,
            hour_attendances as peak_hour_attendances
        FROM (
            SELECT 
                *,
                ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY hour_attendances DESC) as rn
            FROM hourly_stats
        ) ranked
        WHERE rn = 1
    ),
    daily_stats AS (
        SELECT 
            a.store_id,
            DATE(a.started_at) as day,
            COUNT(DISTINCT a.id) as day_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as day_sales
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.store_id, DATE(a.started_at)
    ),
    best_worst_days AS (
        SELECT 
            store_id,
            MAX(CASE WHEN rn_asc = 1 THEN day END) as best_day,
            MAX(CASE WHEN rn_asc = 1 THEN day_attendances END) as best_day_attendances,
            MAX(CASE WHEN rn_asc = 1 THEN day_sales END) as best_day_sales,
            MAX(CASE WHEN rn_desc = 1 THEN day END) as worst_day,
            MAX(CASE WHEN rn_desc = 1 THEN day_attendances END) as worst_day_attendances,
            MAX(CASE WHEN rn_desc = 1 THEN day_sales END) as worst_day_sales
        FROM (
            SELECT 
                *,
                ROW_NUMBER() OVER (ORDER BY day_sales DESC, day_attendances DESC) as rn_asc,
                ROW_NUMBER() OVER (ORDER BY day_sales ASC, day_attendances ASC) as rn_desc
            FROM daily_stats
        ) ranked
        GROUP BY store_id
    ),
    top_collaborator AS (
        SELECT 
            a.store_id,
            a.profile_id,
            p.name as profile_name,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as sales_count
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        JOIN sistemaretiradas.profiles p ON p.id = a.profile_id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.store_id, a.profile_id, p.name
        ORDER BY sales_count DESC
        LIMIT 1
    )
    SELECT 
        s.id as store_id,
        s.name::TEXT as store_name,
        COALESCE(ast.total_attendances, 0)::BIGINT,
        COALESCE(ast.total_sales, 0)::BIGINT,
        COALESCE(ast.total_losses, 0)::BIGINT,
        CASE 
            WHEN ast.total_attendances > 0 THEN
                (ast.total_sales::DECIMAL / ast.total_attendances::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        COALESCE(ast.total_sale_value, 0) as total_sale_value,
        COALESCE(ast.avg_sale_value, 0) as avg_sale_value,
        COALESCE(ast.avg_duration, 0) as avg_attendance_duration,
        COALESCE(ast.total_time, 0) as total_attendance_time,
        COALESCE(ast.active_collaborators, 0)::BIGINT,
        COALESCE(qs.total_queue_time, 0) as total_queue_time,
        COALESCE(qs.avg_queue_time, 0) as avg_queue_time,
        COALESCE(ph.peak_hour, 0)::INTEGER,
        COALESCE(ph.peak_hour_attendances, 0)::BIGINT,
        bwd.best_day,
        COALESCE(bwd.best_day_attendances, 0)::BIGINT,
        COALESCE(bwd.best_day_sales, 0)::BIGINT,
        bwd.worst_day,
        COALESCE(bwd.worst_day_attendances, 0)::BIGINT,
        COALESCE(bwd.worst_day_sales, 0)::BIGINT,
        tc.profile_id as top_collaborator_id,
        tc.profile_name::TEXT as top_collaborator_name,
        COALESCE(tc.sales_count, 0)::BIGINT as top_collaborator_sales
    FROM sistemaretiradas.stores s
    LEFT JOIN attendance_stats ast ON ast.store_id = s.id
    LEFT JOIN queue_stats qs ON qs.store_id = s.id
    LEFT JOIN peak_hour_data ph ON ph.store_id = s.id
    LEFT JOIN best_worst_days bwd ON bwd.store_id = s.id
    LEFT JOIN top_collaborator tc ON tc.store_id = s.id
    WHERE s.id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CORRIGIR get_loss_reasons_analytics - Tipo character varying vs text
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_loss_reasons_analytics(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    loss_reason_id UUID,
    loss_reason_name TEXT,
    total_losses BIGINT,
    percentual DECIMAL,
    avg_attendance_duration INTEGER,
    avg_sale_value_lost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH loss_stats AS (
        SELECT 
            ao.loss_reason_id,
            lr.name::TEXT as loss_reason_name,
            COUNT(DISTINCT ao.attendance_id) as total_losses,
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration,
            COALESCE(AVG(ao.sale_value), 0) as avg_sale_value
        FROM sistemaretiradas.attendance_outcomes ao
        JOIN sistemaretiradas.attendances a ON a.id = ao.attendance_id
        LEFT JOIN sistemaretiradas.loss_reasons lr ON lr.id = ao.loss_reason_id
        WHERE a.store_id = p_store_id
          AND ao.result = 'perda'
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY ao.loss_reason_id, lr.name
    ),
    total_losses AS (
        SELECT COUNT(*)::DECIMAL as total
        FROM sistemaretiradas.attendance_outcomes ao
        JOIN sistemaretiradas.attendances a ON a.id = ao.attendance_id
        WHERE a.store_id = p_store_id
          AND ao.result = 'perda'
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
    )
    SELECT 
        ls.loss_reason_id,
        COALESCE(ls.loss_reason_name, 'Outro')::TEXT as loss_reason_name,
        ls.total_losses::BIGINT,
        CASE 
            WHEN tl.total > 0 THEN
                (ls.total_losses::DECIMAL / tl.total::DECIMAL * 100)
            ELSE 0
        END as percentual,
        ls.avg_duration,
        ls.avg_sale_value
    FROM loss_stats ls
    CROSS JOIN total_losses tl
    ORDER BY ls.total_losses DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CORRIGIR get_collaborators_ranking - Coluna cs.conversion_rate inexistente
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_collaborators_ranking(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    rank INTEGER,
    profile_id UUID,
    profile_name TEXT,
    total_attendances BIGINT,
    total_sales BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_attendance_duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH collaborator_stats AS (
        SELECT 
            a.profile_id,
            p.name as profile_name,
            COUNT(DISTINCT a.id) as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as total_sales,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration,
            -- Calcular conversion_rate na CTE para poder usar no ORDER BY
            CASE 
                WHEN COUNT(DISTINCT a.id) > 0 THEN
                    (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
                ELSE 0
            END as conversion_rate
        FROM sistemaretiradas.attendances a
        JOIN sistemaretiradas.profiles p ON p.id = a.profile_id
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.profile_id, p.name
    )
    SELECT 
        ROW_NUMBER() OVER (ORDER BY cs.total_sales DESC, cs.conversion_rate DESC)::INTEGER as rank,
        cs.profile_id,
        cs.profile_name::TEXT,
        cs.total_attendances::BIGINT,
        cs.total_sales::BIGINT,
        cs.conversion_rate,
        cs.total_sale_value,
        cs.avg_duration
    FROM collaborator_stats cs
    ORDER BY cs.total_sales DESC, cs.conversion_rate DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

