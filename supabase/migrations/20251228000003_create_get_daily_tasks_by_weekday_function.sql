-- ============================================================================
-- Migration: Criar função get_daily_tasks_by_weekday (para Admin)
-- Data: 2025-12-28
-- Descrição: Função para buscar tarefas organizadas por dia da semana (visualização calendário)
-- ============================================================================

-- Função para buscar tarefas organizadas por weekday (para visualização calendário Admin)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks_by_weekday(
    p_store_id UUID
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    due_time TIME,
    priority VARCHAR,
    weekday INTEGER, -- 0 = Domingo, 1 = Segunda, ..., 6 = Sábado, NULL = todos os dias
    shift_id UUID,
    shift_name VARCHAR,
    display_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.due_time,
        dt.priority,
        dt.weekday,
        dt.shift_id,
        s.name as shift_name,
        dt.display_order
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    WHERE dt.store_id = p_store_id
      AND dt.is_active = true
    ORDER BY 
        COALESCE(dt.weekday, 999), -- NULL (todos os dias) no final
        dt.due_time NULLS LAST,
        CASE dt.priority
            WHEN 'ALTA' THEN 1
            WHEN 'MÉDIA' THEN 2
            WHEN 'BAIXA' THEN 3
            ELSE 4
        END, -- Ordena por prioridade (ALTA > MÉDIA > BAIXA)
        dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sistemaretiradas.get_daily_tasks_by_weekday IS 'Busca tarefas organizadas por weekday para visualização calendário no Admin. Retorna tarefas agrupadas por dia da semana.';

