-- ============================================================================
-- Migration: Criar tabela task_overdue_notifications
-- Data: 2025-12-28
-- Descrição: Tabela para registrar notificações de tarefas atrasadas
-- ============================================================================

-- Tabela para registrar notificações de tarefas atrasadas
CREATE TABLE IF NOT EXISTS sistemaretiradas.task_overdue_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES sistemaretiradas.daily_tasks(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    notification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'READ', 'DISMISSED')),
    whatsapp_sent BOOLEAN DEFAULT false,
    whatsapp_sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, notification_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_task_overdue_notifications_store 
ON sistemaretiradas.task_overdue_notifications(store_id, notification_date, status);

CREATE INDEX IF NOT EXISTS idx_task_overdue_notifications_task 
ON sistemaretiradas.task_overdue_notifications(task_id, notification_date);

CREATE INDEX IF NOT EXISTS idx_task_overdue_notifications_status 
ON sistemaretiradas.task_overdue_notifications(status)
WHERE status IN ('PENDING', 'SENT');

-- RLS
ALTER TABLE sistemaretiradas.task_overdue_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver notificações de suas lojas
CREATE POLICY "task_overdue_notifications_select_policy" 
ON sistemaretiradas.task_overdue_notifications
FOR SELECT
USING (
    store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
    )
);

-- Policy: Apenas sistema (service_role) pode inserir notificações
CREATE POLICY "task_overdue_notifications_insert_policy" 
ON sistemaretiradas.task_overdue_notifications
FOR INSERT
WITH CHECK (true); -- Permitido via service_role

-- Policy: Usuários podem atualizar status (marcar como lida/dismissed)
CREATE POLICY "task_overdue_notifications_update_policy" 
ON sistemaretiradas.task_overdue_notifications
FOR UPDATE
USING (
    store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
    )
);

-- Comentários
COMMENT ON TABLE sistemaretiradas.task_overdue_notifications IS 'Notificações de tarefas atrasadas por loja. Criada automaticamente quando tarefa entra em atraso.';
COMMENT ON COLUMN sistemaretiradas.task_overdue_notifications.notification_date IS 'Data da notificação (mesmo dia em que a tarefa entrou em atraso)';
COMMENT ON COLUMN sistemaretiradas.task_overdue_notifications.status IS 'Status da notificação: PENDING (criada mas não processada), SENT (WhatsApp enviado), READ (lida no sistema), DISMISSED (descartada)';

