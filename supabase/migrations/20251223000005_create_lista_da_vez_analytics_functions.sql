-- ============================================================================
-- MIGRATION: Funções Avançadas de Analytics para Lista da Vez
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Funções SQL robustas para analytics detalhadas do sistema
--            de Lista da Vez, incluindo métricas por colaboradora, período,
--            tendências, comparações e relatórios avançados
-- ============================================================================

-- ============================================================================
-- 1. ANALYTICS POR COLABORADORA (DETALHADO)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_collaborator_detailed_metrics(
    p_profile_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    profile_id UUID,
    profile_name TEXT,
    total_attendances BIGINT,
    total_sales BIGINT,
    total_losses BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_sale_value DECIMAL,
    avg_attendance_duration INTEGER,
    total_attendance_time INTEGER,
    min_attendance_duration INTEGER,
    max_attendance_duration INTEGER,
    avg_time_to_first_attendance INTEGER,
    total_queue_time INTEGER,
    avg_queue_time INTEGER,
    best_day DATE,
    best_day_attendances BIGINT,
    best_day_sales BIGINT,
    worst_day DATE,
    worst_day_attendances BIGINT,
    worst_day_sales BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            a.profile_id,
            COUNT(DISTINCT a.id) as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as total_sales,
            COUNT(DISTINCT CASE WHEN ao.result = 'perda' THEN a.id END) as total_losses,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(CASE WHEN ao.result = 'venda' THEN ao.sale_value END), 0) as avg_sale_value,
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration,
            COALESCE(SUM(a.duration_seconds), 0)::INTEGER as total_time,
            COALESCE(MIN(a.duration_seconds), 0)::INTEGER as min_duration,
            COALESCE(MAX(a.duration_seconds), 0)::INTEGER as max_duration
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.profile_id = p_profile_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.profile_id
    ),
    queue_stats AS (
        SELECT 
            qm.profile_id,
            COALESCE(SUM(
                EXTRACT(EPOCH FROM (
                    COALESCE(a.started_at, NOW()) - qm.check_in_at
                ))
            ), 0)::INTEGER as total_queue_time,
            COALESCE(AVG(
                EXTRACT(EPOCH FROM (
                    COALESCE(a.started_at, NOW()) - qm.check_in_at
                ))
            ), 0)::INTEGER as avg_queue_time,
            COALESCE(MIN(
                EXTRACT(EPOCH FROM (
                    COALESCE(a.started_at, NOW()) - qm.check_in_at
                ))
            ), 0)::INTEGER as min_time_to_first
        FROM sistemaretiradas.queue_members qm
        LEFT JOIN sistemaretiradas.attendances a ON a.profile_id = qm.profile_id 
            AND a.session_id = qm.session_id
            AND a.started_at >= qm.check_in_at
        WHERE qm.profile_id = p_profile_id
          AND DATE(qm.check_in_at) BETWEEN p_start_date AND p_end_date
        GROUP BY qm.profile_id
    ),
    daily_stats AS (
        SELECT 
            a.profile_id,
            DATE(a.started_at) as day,
            COUNT(DISTINCT a.id) as day_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as day_sales
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.profile_id = p_profile_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY a.profile_id, DATE(a.started_at)
    ),
    best_worst_days AS (
        SELECT 
            profile_id,
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
        GROUP BY profile_id
    )
    SELECT 
        p.id as profile_id,
        p.name as profile_name,
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
        COALESCE(ast.min_duration, 0) as min_attendance_duration,
        COALESCE(ast.max_duration, 0) as max_attendance_duration,
        COALESCE(qs.min_time_to_first, 0) as avg_time_to_first_attendance,
        COALESCE(qs.total_queue_time, 0) as total_queue_time,
        COALESCE(qs.avg_queue_time, 0) as avg_queue_time,
        bwd.best_day,
        COALESCE(bwd.best_day_attendances, 0)::BIGINT,
        COALESCE(bwd.best_day_sales, 0)::BIGINT,
        bwd.worst_day,
        COALESCE(bwd.worst_day_attendances, 0)::BIGINT,
        COALESCE(bwd.worst_day_sales, 0)::BIGINT
    FROM sistemaretiradas.profiles p
    LEFT JOIN attendance_stats ast ON ast.profile_id = p.id
    LEFT JOIN queue_stats qs ON qs.profile_id = p.id
    LEFT JOIN best_worst_days bwd ON bwd.profile_id = p.id
    WHERE p.id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. ANALYTICS DA LOJA (DETALHADO)
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
        s.name as store_name,
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
        tc.profile_name as top_collaborator_name,
        COALESCE(tc.sales_count, 0)::BIGINT as top_collaborator_sales
    FROM sistemaretiradas.stores s
    LEFT JOIN attendance_stats ast ON ast.store_id = s.id
    LEFT JOIN queue_stats qs ON qs.store_id = s.id
    LEFT JOIN peak_hour_data ph ON ph.store_id = s.id
    LEFT JOIN best_worst_days bwd ON bwd.store_id = s.id
    LEFT JOIN top_collaborator tc ON tc.store_id = s.id
    WHERE s.id = p_store_id
    GROUP BY s.id, s.name, ast.total_attendances, ast.total_sales, ast.total_losses, 
             ast.total_sale_value, ast.avg_sale_value, ast.avg_duration, ast.total_time, 
             ast.active_collaborators, qs.total_queue_time, qs.avg_queue_time, 
             ph.peak_hour, ph.peak_hour_attendances, bwd.best_day, bwd.best_day_attendances, 
             bwd.best_day_sales, bwd.worst_day, bwd.worst_day_attendances, bwd.worst_day_sales,
             tc.profile_id, tc.profile_name, tc.sales_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ANALYTICS POR PERÍODO (TENDÊNCIAS)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_period_trends(
    p_store_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_group_by VARCHAR DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
    period_label TEXT,
    period_start DATE,
    period_end DATE,
    total_attendances BIGINT,
    total_sales BIGINT,
    total_losses BIGINT,
    conversion_rate DECIMAL,
    total_sale_value DECIMAL,
    avg_attendance_duration INTEGER,
    active_collaborators BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH period_groups AS (
        SELECT 
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)::TEXT
                WHEN p_group_by = 'week' THEN TO_CHAR(DATE_TRUNC('week', a.started_at), 'YYYY-MM-DD')
                WHEN p_group_by = 'month' THEN TO_CHAR(DATE_TRUNC('month', a.started_at), 'YYYY-MM')
                ELSE DATE(a.started_at)::TEXT
            END as period_label,
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)
                WHEN p_group_by = 'week' THEN DATE_TRUNC('week', a.started_at)::DATE
                WHEN p_group_by = 'month' THEN DATE_TRUNC('month', a.started_at)::DATE
                ELSE DATE(a.started_at)
            END as period_start,
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)
                WHEN p_group_by = 'week' THEN (DATE_TRUNC('week', a.started_at) + INTERVAL '6 days')::DATE
                WHEN p_group_by = 'month' THEN (DATE_TRUNC('month', a.started_at) + INTERVAL '1 month - 1 day')::DATE
                ELSE DATE(a.started_at)
            END as period_end,
            COUNT(DISTINCT a.id) as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END) as total_sales,
            COUNT(DISTINCT CASE WHEN ao.result = 'perda' THEN a.id END) as total_losses,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration,
            COUNT(DISTINCT a.profile_id) as active_collaborators
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
          AND a.status = 'finalizado'
        GROUP BY 
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)::TEXT
                WHEN p_group_by = 'week' THEN TO_CHAR(DATE_TRUNC('week', a.started_at), 'YYYY-MM-DD')
                WHEN p_group_by = 'month' THEN TO_CHAR(DATE_TRUNC('month', a.started_at), 'YYYY-MM')
                ELSE DATE(a.started_at)::TEXT
            END,
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)
                WHEN p_group_by = 'week' THEN DATE_TRUNC('week', a.started_at)::DATE
                WHEN p_group_by = 'month' THEN DATE_TRUNC('month', a.started_at)::DATE
                ELSE DATE(a.started_at)
            END,
            CASE 
                WHEN p_group_by = 'day' THEN DATE(a.started_at)
                WHEN p_group_by = 'week' THEN (DATE_TRUNC('week', a.started_at) + INTERVAL '6 days')::DATE
                WHEN p_group_by = 'month' THEN (DATE_TRUNC('month', a.started_at) + INTERVAL '1 month - 1 day')::DATE
                ELSE DATE(a.started_at)
            END
    )
    SELECT 
        pg.period_label,
        pg.period_start,
        pg.period_end,
        pg.total_attendances::BIGINT,
        pg.total_sales::BIGINT,
        pg.total_losses::BIGINT,
        CASE 
            WHEN pg.total_attendances > 0 THEN
                (pg.total_sales::DECIMAL / pg.total_attendances::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        pg.total_sale_value,
        pg.avg_duration,
        pg.active_collaborators::BIGINT
    FROM period_groups pg
    ORDER BY pg.period_start ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ANALYTICS DE MOTIVOS DE PERDA
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
            lr.name as loss_reason_name,
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
        COALESCE(ls.loss_reason_name, 'Outro') as loss_reason_name,
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
-- 5. ANALYTICS DE HORÁRIOS (HORA DO DIA)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_hourly_analytics(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    hour INTEGER,
    total_attendances BIGINT,
    total_sales BIGINT,
    conversion_rate DECIMAL,
    avg_attendance_duration INTEGER,
    avg_sale_value DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM a.started_at)::INTEGER as hour,
        COUNT(DISTINCT a.id)::BIGINT as total_attendances,
        COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::BIGINT as total_sales,
        CASE 
            WHEN COUNT(DISTINCT a.id) > 0 THEN
                (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_attendance_duration,
        COALESCE(AVG(CASE WHEN ao.result = 'venda' THEN ao.sale_value END), 0) as avg_sale_value
    FROM sistemaretiradas.attendances a
    LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
    WHERE a.store_id = p_store_id
      AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
      AND a.status = 'finalizado'
    GROUP BY EXTRACT(HOUR FROM a.started_at)
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RANKING DE COLABORADORAS
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
            COALESCE(AVG(a.duration_seconds), 0)::INTEGER as avg_duration
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
        cs.profile_name,
        cs.total_attendances::BIGINT,
        cs.total_sales::BIGINT,
        CASE 
            WHEN cs.total_attendances > 0 THEN
                (cs.total_sales::DECIMAL / cs.total_attendances::DECIMAL * 100)
            ELSE 0
        END as conversion_rate,
        cs.total_sale_value,
        cs.avg_duration
    FROM collaborator_stats cs
    ORDER BY cs.total_sales DESC, cs.conversion_rate DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. COMPARAÇÃO ENTRE PERÍODOS
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.compare_periods(
    p_store_id UUID,
    p_period1_start DATE,
    p_period1_end DATE,
    p_period2_start DATE,
    p_period2_end DATE
)
RETURNS TABLE (
    metric_name TEXT,
    period1_value DECIMAL,
    period2_value DECIMAL,
    difference DECIMAL,
    percent_change DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH period1_stats AS (
        SELECT 
            COUNT(DISTINCT a.id)::DECIMAL as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL as total_sales,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(a.duration_seconds), 0) as avg_duration,
            CASE 
                WHEN COUNT(DISTINCT a.id) > 0 THEN
                    (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
                ELSE 0
            END as conversion_rate
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_period1_start AND p_period1_end
          AND a.status = 'finalizado'
    ),
    period2_stats AS (
        SELECT 
            COUNT(DISTINCT a.id)::DECIMAL as total_attendances,
            COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL as total_sales,
            COALESCE(SUM(CASE WHEN ao.result = 'venda' THEN ao.sale_value ELSE 0 END), 0) as total_sale_value,
            COALESCE(AVG(a.duration_seconds), 0) as avg_duration,
            CASE 
                WHEN COUNT(DISTINCT a.id) > 0 THEN
                    (COUNT(DISTINCT CASE WHEN ao.result = 'venda' THEN a.id END)::DECIMAL / COUNT(DISTINCT a.id)::DECIMAL * 100)
                ELSE 0
            END as conversion_rate
        FROM sistemaretiradas.attendances a
        LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
        WHERE a.store_id = p_store_id
          AND DATE(a.started_at) BETWEEN p_period2_start AND p_period2_end
          AND a.status = 'finalizado'
    )
    SELECT 
        'Total Atendimentos'::TEXT,
        p1.total_attendances,
        p2.total_attendances,
        (p2.total_attendances - p1.total_attendances),
        CASE 
            WHEN p1.total_attendances > 0 THEN
                ((p2.total_attendances - p1.total_attendances) / p1.total_attendances * 100)
            ELSE 0
        END
    FROM period1_stats p1, period2_stats p2
    
    UNION ALL
    
    SELECT 
        'Total Vendas'::TEXT,
        p1.total_sales,
        p2.total_sales,
        (p2.total_sales - p1.total_sales),
        CASE 
            WHEN p1.total_sales > 0 THEN
                ((p2.total_sales - p1.total_sales) / p1.total_sales * 100)
            ELSE 0
        END
    FROM period1_stats p1, period2_stats p2
    
    UNION ALL
    
    SELECT 
        'Faturamento Total'::TEXT,
        p1.total_sale_value,
        p2.total_sale_value,
        (p2.total_sale_value - p1.total_sale_value),
        CASE 
            WHEN p1.total_sale_value > 0 THEN
                ((p2.total_sale_value - p1.total_sale_value) / p1.total_sale_value * 100)
            ELSE 0
        END
    FROM period1_stats p1, period2_stats p2
    
    UNION ALL
    
    SELECT 
        'Taxa de Conversão (%)'::TEXT,
        p1.conversion_rate,
        p2.conversion_rate,
        (p2.conversion_rate - p1.conversion_rate),
        CASE 
            WHEN p1.conversion_rate > 0 THEN
                ((p2.conversion_rate - p1.conversion_rate) / p1.conversion_rate * 100)
            ELSE 0
        END
    FROM period1_stats p1, period2_stats p2
    
    UNION ALL
    
    SELECT 
        'Tempo Médio (min)'::TEXT,
        (p1.avg_duration / 60),
        (p2.avg_duration / 60),
        ((p2.avg_duration - p1.avg_duration) / 60),
        CASE 
            WHEN p1.avg_duration > 0 THEN
                (((p2.avg_duration - p1.avg_duration) / p1.avg_duration) * 100)
            ELSE 0
        END
    FROM period1_stats p1, period2_stats p2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. EXPORTAÇÃO DE DADOS PARA ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.export_attendance_data(
    p_store_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    attendance_id UUID,
    date DATE,
    hour INTEGER,
    profile_id UUID,
    profile_name TEXT,
    cliente_nome TEXT,
    duration_minutes INTEGER,
    result TEXT,
    sale_value DECIMAL,
    loss_reason TEXT,
    session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as attendance_id,
        DATE(a.started_at) as date,
        EXTRACT(HOUR FROM a.started_at)::INTEGER as hour,
        a.profile_id,
        p.name as profile_name,
        a.cliente_nome,
        COALESCE((a.duration_seconds / 60)::INTEGER, 0) as duration_minutes,
        COALESCE(ao.result, 'sem_resultado') as result,
        COALESCE(ao.sale_value, 0) as sale_value,
        COALESCE(lr.name, ao.loss_reason_other, '') as loss_reason,
        a.session_id
    FROM sistemaretiradas.attendances a
    JOIN sistemaretiradas.profiles p ON p.id = a.profile_id
    LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
    LEFT JOIN sistemaretiradas.loss_reasons lr ON lr.id = ao.loss_reason_id
    WHERE a.store_id = p_store_id
      AND DATE(a.started_at) BETWEEN p_start_date AND p_end_date
      AND a.status = 'finalizado'
    ORDER BY a.started_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ✅ MIGRATION COMPLETA - FUNÇÕES DE ANALYTICS
-- ============================================================================

