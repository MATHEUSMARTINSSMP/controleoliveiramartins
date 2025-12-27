-- ============================================================================
-- Migration: Habilitar Realtime para tabelas de tarefas
-- Data: 2025-12-28
-- Descrição: Habilita Supabase Realtime para atualizações em tempo real
-- ============================================================================

-- Habilitar Realtime para task_completions (mudanças de conclusão)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'sistemaretiradas' 
        AND tablename = 'task_completions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.task_completions;
    END IF;
END $$;

-- Habilitar Realtime para task_overdue_notifications (novas notificações)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'sistemaretiradas' 
        AND tablename = 'task_overdue_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.task_overdue_notifications;
    END IF;
END $$;

-- Habilitar Realtime para daily_tasks (atualizações nas tarefas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'sistemaretiradas' 
        AND tablename = 'daily_tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.daily_tasks;
    END IF;
END $$;

-- Grant permissions para Realtime
GRANT SELECT ON sistemaretiradas.task_completions TO anon;
GRANT SELECT ON sistemaretiradas.task_completions TO authenticated;

GRANT SELECT ON sistemaretiradas.task_overdue_notifications TO anon;
GRANT SELECT ON sistemaretiradas.task_overdue_notifications TO authenticated;

GRANT SELECT ON sistemaretiradas.daily_tasks TO anon;
GRANT SELECT ON sistemaretiradas.daily_tasks TO authenticated;

-- Comentários
COMMENT ON TABLE sistemaretiradas.task_completions IS 'Execuções de tarefas - Realtime enabled para atualizações em tempo real';
COMMENT ON TABLE sistemaretiradas.task_overdue_notifications IS 'Notificações de tarefas atrasadas - Realtime enabled para notificações em tempo real';
COMMENT ON TABLE sistemaretiradas.daily_tasks IS 'Tarefas diárias - Realtime enabled para atualizações em tempo real';

