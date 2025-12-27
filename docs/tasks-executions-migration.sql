-- Migration: Tabela de Execuções de Tarefas Diárias
-- Propósito: Registrar quem executou cada tarefa em cada data específica
-- Mantém daily_tasks como template e daily_task_executions como histórico

-- 1. Criar tabela de execuções
CREATE TABLE IF NOT EXISTS sistemaretiradas.daily_task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES sistemaretiradas.daily_tasks(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    execution_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES sistemaretiradas.profiles(id),
    completion_notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_id, execution_date)
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_task_executions_store_date 
ON sistemaretiradas.daily_task_executions(store_id, execution_date);

CREATE INDEX IF NOT EXISTS idx_task_executions_task_date 
ON sistemaretiradas.daily_task_executions(task_id, execution_date);

CREATE INDEX IF NOT EXISTS idx_task_executions_completed_by 
ON sistemaretiradas.daily_task_executions(completed_by);

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_task_execution_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_execution_updated_at ON sistemaretiradas.daily_task_executions;
CREATE TRIGGER task_execution_updated_at
    BEFORE UPDATE ON sistemaretiradas.daily_task_executions
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_task_execution_updated_at();

-- 4. RLS Policies
ALTER TABLE sistemaretiradas.daily_task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojas podem ver suas execuções" ON sistemaretiradas.daily_task_executions
    FOR SELECT USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "Lojas podem inserir execuções" ON sistemaretiradas.daily_task_executions
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "Lojas podem atualizar suas execuções" ON sistemaretiradas.daily_task_executions
    FOR UPDATE USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.profiles 
            WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles 
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
    );

-- 5. Função para buscar tarefas do dia com status de execução
CREATE OR REPLACE FUNCTION sistemaretiradas.get_tasks_for_date(
    p_store_id UUID,
    p_date DATE
)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    description TEXT,
    due_time TIME,
    priority TEXT,
    weekday INT,
    shift_id UUID,
    shift_name TEXT,
    execution_id UUID,
    is_completed BOOLEAN,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    completed_by_name TEXT,
    completion_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id AS task_id,
        dt.title,
        dt.description,
        dt.due_time,
        dt.priority,
        dt.weekday,
        dt.shift_id,
        s.name AS shift_name,
        dte.id AS execution_id,
        COALESCE(dte.is_completed, FALSE) AS is_completed,
        dte.completed_at,
        dte.completed_by,
        p.name AS completed_by_name,
        dte.completion_notes
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON dt.shift_id = s.id
    LEFT JOIN sistemaretiradas.daily_task_executions dte 
        ON dt.id = dte.task_id AND dte.execution_date = p_date
    LEFT JOIN sistemaretiradas.profiles p ON dte.completed_by = p.id
    WHERE dt.store_id = p_store_id
        AND dt.is_active = TRUE
        AND (dt.weekday IS NULL OR dt.weekday = EXTRACT(DOW FROM p_date)::INT)
    ORDER BY dt.due_time NULLS LAST, dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para marcar tarefa como concluída (nome compatível com hook existente)
CREATE OR REPLACE FUNCTION sistemaretiradas.complete_task(
    p_task_id UUID,
    p_profile_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_execution_id UUID;
    v_store_id UUID;
BEGIN
    -- Buscar store_id da tarefa
    SELECT store_id INTO v_store_id 
    FROM sistemaretiradas.daily_tasks 
    WHERE id = p_task_id;
    
    IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'Tarefa não encontrada';
    END IF;

    INSERT INTO sistemaretiradas.daily_task_executions (
        task_id, store_id, execution_date, is_completed, completed_at, completed_by, completion_notes
    )
    VALUES (
        p_task_id, v_store_id, p_completion_date, TRUE, NOW(), p_profile_id, p_notes
    )
    ON CONFLICT (task_id, execution_date) 
    DO UPDATE SET 
        is_completed = TRUE,
        completed_at = NOW(),
        completed_by = p_profile_id,
        completion_notes = COALESCE(p_notes, daily_task_executions.completion_notes),
        updated_at = NOW()
    RETURNING id INTO v_execution_id;
    
    RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para desmarcar tarefa (nome compatível com hook existente)
CREATE OR REPLACE FUNCTION sistemaretiradas.uncomplete_task(
    p_task_id UUID,
    p_profile_id UUID,
    p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sistemaretiradas.daily_task_executions
    SET is_completed = FALSE,
        completed_at = NULL,
        completed_by = NULL,
        updated_at = NOW()
    WHERE task_id = p_task_id AND execution_date = p_completion_date;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função para histórico de execuções (Admin)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_task_execution_history(
    p_store_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    execution_date DATE,
    task_id UUID,
    task_title TEXT,
    task_priority TEXT,
    due_time TIME,
    is_completed BOOLEAN,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    completed_by_name TEXT,
    completion_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE AS exec_date
    ),
    tasks_for_dates AS (
        SELECT 
            dr.exec_date,
            dt.id AS task_id,
            dt.title AS task_title,
            dt.priority AS task_priority,
            dt.due_time
        FROM date_range dr
        CROSS JOIN sistemaretiradas.daily_tasks dt
        WHERE dt.store_id = p_store_id
            AND dt.is_active = TRUE
            AND (dt.weekday IS NULL OR dt.weekday = EXTRACT(DOW FROM dr.exec_date)::INT)
    )
    SELECT 
        tfd.exec_date AS execution_date,
        tfd.task_id,
        tfd.task_title,
        tfd.task_priority,
        tfd.due_time,
        COALESCE(dte.is_completed, FALSE) AS is_completed,
        dte.completed_at,
        dte.completed_by,
        p.name AS completed_by_name,
        dte.completion_notes
    FROM tasks_for_dates tfd
    LEFT JOIN sistemaretiradas.daily_task_executions dte 
        ON tfd.task_id = dte.task_id AND tfd.exec_date = dte.execution_date
    LEFT JOIN sistemaretiradas.profiles p ON dte.completed_by = p.id
    ORDER BY tfd.exec_date DESC, tfd.due_time NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Função get_daily_tasks (compatível com hook existente)
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks(
    p_store_id UUID,
    p_date DATE
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title TEXT,
    description TEXT,
    shift_id UUID,
    shift_name TEXT,
    shift_start_time TIME,
    shift_end_time TIME,
    shift_color TEXT,
    due_time TIME,
    priority TEXT,
    weekday INT,
    status TEXT,
    is_active BOOLEAN,
    is_recurring BOOLEAN,
    display_order INT,
    created_at TIMESTAMPTZ,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.shift_id,
        s.name AS shift_name,
        s.start_time AS shift_start_time,
        s.end_time AS shift_end_time,
        s.color AS shift_color,
        dt.due_time,
        dt.priority,
        dt.weekday,
        CASE 
            WHEN dte.is_completed THEN 'CONCLUÍDA'::TEXT
            WHEN dt.due_time IS NOT NULL AND p_date = CURRENT_DATE AND dt.due_time < CURRENT_TIME THEN 'ATRASADO'::TEXT
            ELSE 'PENDENTE'::TEXT
        END AS status,
        dt.is_active,
        COALESCE(dt.is_recurring, TRUE) AS is_recurring,
        dt.display_order,
        dt.created_at,
        dte.completed_by,
        dte.completed_at,
        dte.completion_notes
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON dt.shift_id = s.id
    LEFT JOIN sistemaretiradas.daily_task_executions dte 
        ON dt.id = dte.task_id AND dte.execution_date = p_date
    WHERE dt.store_id = p_store_id
        AND dt.is_active = TRUE
        AND (dt.weekday IS NULL OR dt.weekday = EXTRACT(DOW FROM p_date)::INT)
    ORDER BY dt.due_time NULLS LAST, dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_tasks_for_date TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.complete_task TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.uncomplete_task TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_task_execution_history TO authenticated;
GRANT EXECUTE ON FUNCTION sistemaretiradas.get_daily_tasks TO authenticated;
