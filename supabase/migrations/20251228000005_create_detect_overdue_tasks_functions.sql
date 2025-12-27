-- ============================================================================
-- Migration: Criar funções para detectar tarefas atrasadas
-- Data: 2025-12-28
-- Descrição: Funções para detectar e criar notificações de tarefas atrasadas
-- ============================================================================

-- Função para detectar tarefas que entraram em atraso
CREATE OR REPLACE FUNCTION sistemaretiradas.detect_overdue_tasks(
    p_current_date DATE DEFAULT CURRENT_DATE,
    p_current_time TIME DEFAULT CURRENT_TIME::TIME
)
RETURNS TABLE (
    task_id UUID,
    store_id UUID,
    title VARCHAR,
    due_time TIME,
    weekday INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id as task_id,
        dt.store_id,
        dt.title,
        dt.due_time,
        dt.weekday
    FROM sistemaretiradas.daily_tasks dt
    WHERE dt.is_active = true
      AND dt.due_time IS NOT NULL
      AND dt.due_time < p_current_time
      AND (
        dt.weekday IS NULL -- Tarefas que aparecem todos os dias
        OR dt.weekday = EXTRACT(DOW FROM p_current_date)::INTEGER -- Tarefas do dia específico
      )
      AND NOT EXISTS (
        -- Não incluir tarefas já completadas hoje
        SELECT 1 FROM sistemaretiradas.task_completions tc
        WHERE tc.task_id = dt.id
          AND tc.completion_date = p_current_date
      )
      AND NOT EXISTS (
        -- Não incluir tarefas já notificadas hoje
        SELECT 1 FROM sistemaretiradas.task_overdue_notifications ton
        WHERE ton.task_id = dt.id
          AND ton.notification_date = p_current_date
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sistemaretiradas.detect_overdue_tasks IS 'Detecta tarefas que entraram em atraso no dia/horário especificados. Não inclui tarefas já completadas ou já notificadas.';

-- Função para criar notificação de tarefa atrasada
CREATE OR REPLACE FUNCTION sistemaretiradas.create_overdue_notification(
    p_task_id UUID,
    p_store_id UUID,
    p_notification_date DATE DEFAULT CURRENT_DATE,
    p_due_time TIME
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO sistemaretiradas.task_overdue_notifications (
        task_id,
        store_id,
        notification_date,
        due_time,
        status
    ) VALUES (
        p_task_id,
        p_store_id,
        p_notification_date,
        p_due_time,
        'PENDING'
    )
    ON CONFLICT (task_id, notification_date) DO NOTHING
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sistemaretiradas.create_overdue_notification IS 'Cria uma notificação de tarefa atrasada. Retorna o ID da notificação criada ou NULL se já existe.';

