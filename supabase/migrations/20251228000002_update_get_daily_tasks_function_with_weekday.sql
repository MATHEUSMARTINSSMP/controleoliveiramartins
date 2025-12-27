-- ============================================================================
-- Migration: Atualizar função get_daily_tasks para usar weekday
-- Data: 2025-12-28
-- Descrição: Atualiza função para usar weekday ao invés de is_recurring e adiciona campos priority e status
-- ============================================================================

-- Remover função existente primeiro (para permitir mudança de tipo de retorno)
DROP FUNCTION IF EXISTS sistemaretiradas.get_daily_tasks(UUID, DATE);

-- Recriar função get_daily_tasks com weekday e incluir priority e status
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks(
    p_store_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    shift_id UUID,
    shift_name VARCHAR,
    shift_start_time TIME,
    shift_end_time TIME,
    shift_color VARCHAR,
    due_time TIME,
    priority VARCHAR, -- ✅ NOVO
    weekday INTEGER, -- ✅ NOVO
    is_active BOOLEAN,
    display_order INTEGER,
    created_at TIMESTAMPTZ,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    status VARCHAR -- ✅ NOVO: 'PENDENTE', 'ATRASADO', 'CONCLUÍDA'
) AS $$
DECLARE
    v_weekday INTEGER;
BEGIN
    -- Calcular dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
    -- PostgreSQL: EXTRACT(DOW FROM date) retorna 0 (Domingo) a 6 (Sábado)
    v_weekday := EXTRACT(DOW FROM p_date)::INTEGER;

    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.shift_id,
        s.name as shift_name,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.color as shift_color,
        dt.due_time,
        dt.priority, -- ✅ NOVO
        dt.weekday, -- ✅ NOVO
        dt.is_active,
        dt.display_order,
        dt.created_at,
        tc.profile_id as completed_by,
        tc.completed_at,
        tc.notes as completion_notes,
        CASE -- ✅ NOVO: Calcula status baseado no dia atual
            WHEN tc.completed_at IS NOT NULL THEN 'CONCLUÍDA'
            WHEN dt.due_time IS NOT NULL AND dt.due_time < CURRENT_TIME::TIME THEN 'ATRASADO'
            ELSE 'PENDENTE'
        END as status
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    LEFT JOIN sistemaretiradas.task_completions tc ON tc.task_id = dt.id 
        AND tc.completion_date = p_date
    WHERE dt.store_id = p_store_id
      AND dt.is_active = true
      AND (
        dt.weekday IS NULL -- Tarefas que aparecem todos os dias
        OR dt.weekday = v_weekday -- Tarefas do dia da semana específico
      )
    ORDER BY 
        dt.due_time NULLS LAST,
        CASE dt.priority
            WHEN 'ALTA' THEN 1
            WHEN 'MÉDIA' THEN 2
            WHEN 'BAIXA' THEN 3
            ELSE 4
        END, -- ✅ NOVO: Ordena por prioridade (ALTA > MÉDIA > BAIXA)
        dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

