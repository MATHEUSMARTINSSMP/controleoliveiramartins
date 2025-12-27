-- Migration: Add tasks_whatsapp_notificacoes_ativas column to stores table
-- Date: 2024-12-27
-- Description: Adds configuration to enable/disable WhatsApp notifications for overdue tasks

-- Add the new column to stores table
ALTER TABLE sistemaretiradas.stores 
ADD COLUMN IF NOT EXISTS tasks_whatsapp_notificacoes_ativas BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN sistemaretiradas.stores.tasks_whatsapp_notificacoes_ativas IS 
'Enable/disable automatic WhatsApp notifications for overdue tasks. When true, the system will send WhatsApp messages to the store phone number (whatsapp column) when tasks are overdue.';

-- Create table for tracking overdue task notifications (if not exists)
CREATE TABLE IF NOT EXISTS sistemaretiradas.task_overdue_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES sistemaretiradas.daily_tasks(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    notification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    whatsapp_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, notification_date)
);

-- Add RLS policies
ALTER TABLE sistemaretiradas.task_overdue_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view all notifications
CREATE POLICY IF NOT EXISTS "Admins can view all task notifications"
    ON sistemaretiradas.task_overdue_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.stores s
            WHERE s.id = task_overdue_notifications.store_id
            AND s.admin_id = auth.uid()
        )
    );

-- Policy for service role to manage notifications (for Edge Functions)
CREATE POLICY IF NOT EXISTS "Service role can manage task notifications"
    ON sistemaretiradas.task_overdue_notifications
    FOR ALL
    USING (auth.role() = 'service_role');
