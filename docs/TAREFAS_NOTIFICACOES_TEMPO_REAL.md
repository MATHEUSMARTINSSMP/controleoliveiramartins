# 🔔 Sistema de Notificações em Tempo Real - Tarefas Atrasadas

**Data:** 2025-12-28  
**Objetivo:** Implementar notificações em tempo real quando tarefas entram em atraso

---

## 📋 REQUISITOS

1. ✅ **Notificação no Dash Loja** quando tarefa entra em atraso
2. ✅ **Notificação via WhatsApp** (número global) para número da loja
3. ✅ **Tempo Real**: Notificações aparecem sem precisar atualizar (F5)
4. ✅ **Tempo Real**: Mudança de status também em tempo real (sem F5)

---

## 🗄️ PARTE 1: BANCO DE DADOS

### 1.1 Tabela: `task_overdue_notifications`

**Migration:** `20251228000003_create_task_overdue_notifications.sql`

```sql
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
ON sistemaretiradas.task_overdue_notifications(status);

-- RLS
ALTER TABLE sistemaretiradas.task_overdue_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_overdue_notifications_select_policy" 
ON sistemaretiradas.task_overdue_notifications
FOR SELECT
USING (
    store_id IN (
        SELECT store_id FROM sistemaretiradas.profiles
        WHERE id = auth.uid()
    )
);

COMMENT ON TABLE sistemaretiradas.task_overdue_notifications IS 'Notificações de tarefas atrasadas por loja';
```

### 1.2 Função: Detectar Tarefas Atrasadas

**Migration:** `20251228000004_create_function_detect_overdue_tasks.sql`

```sql
-- Função para detectar tarefas que entraram em atraso
CREATE OR REPLACE FUNCTION sistemaretiradas.detect_overdue_tasks(
    p_current_date DATE DEFAULT CURRENT_DATE,
    p_current_time TIME DEFAULT CURRENT_TIME
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
```

---

## 🔧 PARTE 2: BACKEND (NETLIFY FUNCTIONS)

### 2.1 Função: `task-check-overdue.js`

**Localização:** `netlify/functions/task-check-overdue.js`

**Funcionalidade:**
- Cron job que roda a cada 1 minuto (ou configurável)
- Detecta tarefas que entraram em atraso
- Cria notificações na tabela `task_overdue_notifications`
- Envia notificação via WhatsApp (número global)
- Usa função `detect_overdue_tasks` do banco

**Código Base:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event, context) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'sistemaretiradas' }
    });

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // Detectar tarefas atrasadas
    const { data: overdueTasks, error: detectError } = await supabase
      .rpc('detect_overdue_tasks', {
        p_current_date: currentDate,
        p_current_time: currentTime
      });

    if (detectError) throw detectError;

    if (!overdueTasks || overdueTasks.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No overdue tasks', count: 0 })
      };
    }

    // Processar cada tarefa atrasada
    const results = [];
    for (const task of overdueTasks) {
      // 1. Criar notificação
      const { data: notificationId, error: notifError } = await supabase
        .rpc('create_overdue_notification', {
          p_task_id: task.task_id,
          p_store_id: task.store_id,
          p_notification_date: currentDate,
          p_due_time: task.due_time
        });

      if (notifError) {
        console.error(`[task-check-overdue] Erro ao criar notificação para tarefa ${task.task_id}:`, notifError);
        continue;
      }

      // 2. Buscar informações da loja (telefone WhatsApp)
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('name, whatsapp')
        .eq('id', task.store_id)
        .single();

      if (storeError || !store) {
        console.error(`[task-check-overdue] Erro ao buscar loja ${task.store_id}:`, storeError);
        continue;
      }

      // 3. Enviar WhatsApp (número global para número da loja)
      if (store.whatsapp) {
        try {
          const whatsappMessage = `⚠️ *Tarefa Atrasada*\n\n` +
            `*Tarefa:* ${task.title}\n` +
            `*Prazo:* ${task.due_time}\n` +
            `*Loja:* ${store.name}\n\n` +
            `Por favor, verifique no sistema.`;

          // Chamar função de envio WhatsApp
          // TODO: Implementar chamada para send-whatsapp-message
          // await sendWhatsAppNotification(store.whatsapp, whatsappMessage);

          // Atualizar notificação como enviada
          await supabase
            .from('task_overdue_notifications')
            .update({
              whatsapp_sent: true,
              whatsapp_sent_at: new Date().toISOString(),
              status: 'SENT'
            })
            .eq('id', notificationId);

        } catch (whatsappError) {
          console.error(`[task-check-overdue] Erro ao enviar WhatsApp:`, whatsappError);
        }
      }

      results.push({
        task_id: task.task_id,
        store_id: task.store_id,
        notification_id: notificationId,
        whatsapp_sent: !!store.whatsapp
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        overdue_count: overdueTasks.length,
        processed: results.length,
        results
      })
    };

  } catch (error) {
    console.error('[task-check-overdue] Erro:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### 2.2 Configurar Cron Job

**Opção 1: Netlify Cron**
- Configurar no `netlify.toml`:
```toml
[[plugins]]
package = "@netlify/plugin-scheduled-functions"

[[plugins.inputs]]
schedule = "*/1 * * * *" # A cada 1 minuto
function = "task-check-overdue"
```

**Opção 2: Supabase pg_cron**
```sql
-- Criar cron job para rodar a cada 1 minuto
SELECT cron.schedule(
    'check-overdue-tasks',
    '* * * * *', -- A cada minuto
    $$
    SELECT net.http_post(
        url := 'https://eleveaone.com.br/.netlify/functions/task-check-overdue',
        headers := '{"Content-Type": "application/json", "X-Secret-Key": "SEU_SECRET_KEY"}'::jsonb
    ) AS request_id;
    $$
);
```

---

## 🔄 PARTE 3: TEMPO REAL (SUPABASE REALTIME)

### 3.1 Habilitar Realtime nas Tabelas

**Migration:** `20251228000005_enable_realtime_for_tasks.sql`

```sql
-- Habilitar Realtime para task_completions
ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.task_completions;

-- Habilitar Realtime para task_overdue_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.task_overdue_notifications;

-- Habilitar Realtime para daily_tasks (atualizações)
ALTER PUBLICATION supabase_realtime ADD TABLE sistemaretiradas.daily_tasks;
```

### 3.2 Hook: `useTasksRealtime.ts`

**Localização:** `src/hooks/useTasksRealtime.ts`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseTasksRealtimeOptions {
  storeId: string | null;
  onTaskCompleted?: (taskId: string, completed: boolean) => void;
  onTaskOverdue?: (notification: any) => void;
  enabled?: boolean;
}

export function useTasksRealtime({
  storeId,
  onTaskCompleted,
  onTaskOverdue,
  enabled = true
}: UseTasksRealtimeOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!storeId || !enabled) return;

    // Canal para task_completions (mudanças de conclusão)
    const completionsChannel = supabase
      .channel(`task_completions:store:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sistemaretiradas',
          table: 'task_completions',
          filter: `store_id=eq.${storeId}`
        },
        (payload) => {
          console.log('[useTasksRealtime] Mudança em task_completions:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Tarefa foi completada
            onTaskCompleted?.(payload.new.task_id, true);
          } else if (payload.eventType === 'DELETE') {
            // Tarefa foi desmarcada
            onTaskCompleted?.(payload.old.task_id, false);
          }
        }
      )
      .subscribe();

    // Canal para task_overdue_notifications (novas notificações)
    const notificationsChannel = supabase
      .channel(`task_overdue_notifications:store:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'sistemaretiradas',
          table: 'task_overdue_notifications',
          filter: `store_id=eq.${storeId},status=eq.PENDING`
        },
        (payload) => {
          console.log('[useTasksRealtime] Nova notificação de tarefa atrasada:', payload);
          onTaskOverdue?.(payload.new);
        }
      )
      .subscribe();

    setChannel(completionsChannel);

    return () => {
      supabase.removeChannel(completionsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [storeId, enabled, onTaskCompleted, onTaskOverdue]);

  return { channel };
}
```

---

## 🎨 PARTE 4: COMPONENTES FRONTEND

### 4.1 Componente: `TaskOverdueNotification.tsx`

**Localização:** `src/components/loja/TaskOverdueNotification.tsx`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { useTasksRealtime } from '@/hooks/useTasksRealtime';

interface TaskOverdueNotificationProps {
  storeId: string | null;
}

export function TaskOverdueNotification({ storeId }: TaskOverdueNotificationProps) {
  const [notifications, setNotifications] = useState<any[]>([]);

  // Buscar notificações pendentes
  useEffect(() => {
    if (!storeId) return;

    const fetchNotifications = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('task_overdue_notifications')
        .select(`
          *,
          daily_tasks:task_id (
            id,
            title,
            due_time
          )
        `)
        .eq('store_id', storeId)
        .eq('notification_date', today)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TaskOverdueNotification] Erro ao buscar notificações:', error);
        return;
      }

      setNotifications(data || []);
    };

    fetchNotifications();
  }, [storeId]);

  // Escutar novas notificações em tempo real
  useTasksRealtime({
    storeId,
    onTaskOverdue: (notification) => {
      console.log('[TaskOverdueNotification] Nova notificação recebida:', notification);
      
      // Buscar detalhes da tarefa
      supabase
        .schema('sistemaretiradas')
        .from('daily_tasks')
        .select('title, due_time')
        .eq('id', notification.task_id)
        .single()
        .then(({ data: task }) => {
          if (task) {
            // Mostrar toast
            toast.error(`⚠️ Tarefa Atrasada: ${task.title}`, {
              description: `Prazo: ${task.due_time}`,
              duration: 10000,
              icon: <AlertTriangle className="h-5 w-5" />,
            });

            // Adicionar à lista de notificações
            setNotifications(prev => [notification, ...prev]);
          }
        });
    },
    enabled: !!storeId
  });

  // Marcar notificação como lida
  const markAsRead = async (notificationId: string) => {
    await supabase
      .schema('sistemaretiradas')
      .from('task_overdue_notifications')
      .update({
        status: 'READ',
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">
                Tarefa Atrasada: {notification.daily_tasks?.title}
              </p>
              <p className="text-sm text-red-700">
                Prazo: {notification.due_time}
              </p>
            </div>
          </div>
          <button
            onClick={() => markAsRead(notification.id)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Marcar como lida
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 4.2 Atualizar `useDailyTasks` para Tempo Real

```typescript
// Adicionar subscription Realtime no hook useDailyTasks
useEffect(() => {
  if (!storeId || !enabled) return;

  // Subscription para task_completions
  const channel = supabase
    .channel(`tasks:store:${storeId}:date:${dateStr}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'sistemaretiradas',
        table: 'task_completions',
        filter: `completion_date=eq.${dateStr}`
      },
      (payload) => {
        console.log('[useDailyTasks] Mudança em task_completions:', payload);
        // Recarregar tarefas
        fetchTasks();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [storeId, date, enabled]);
```

### 4.3 Integrar no `LojaTasksCalendarView.tsx`

```typescript
import { TaskOverdueNotification } from './TaskOverdueNotification';
import { useTasksRealtime } from '@/hooks/useTasksRealtime';

export function LojaTasksCalendarView({ storeId }: Props) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  
  // Tempo real: atualizar quando tarefa for completada
  useTasksRealtime({
    storeId,
    onTaskCompleted: (taskId, completed) => {
      // Atualizar estado local sem recarregar
      setTasks(prev => prev.map(task => 
        task.id === taskId
          ? { 
              ...task, 
              completed_by: completed ? currentUserId : null,
              completed_at: completed ? new Date().toISOString() : null,
              status: completed ? 'CONCLUÍDA' : 'PENDENTE'
            }
          : task
      ));
    }
  });

  return (
    <div>
      {/* Notificações de tarefas atrasadas */}
      <TaskOverdueNotification storeId={storeId} />
      
      {/* Lista de tarefas */}
      {/* ... */}
    </div>
  );
}
```

---

## 📋 CHECKLIST IMPLEMENTAÇÃO

### Backend:
- [ ] Criar migration `task_overdue_notifications`
- [ ] Criar funções `detect_overdue_tasks` e `create_overdue_notification`
- [ ] Criar função Netlify `task-check-overdue.js`
- [ ] Integrar envio WhatsApp (número global)
- [ ] Configurar cron job (Netlify ou pg_cron)
- [ ] Habilitar Realtime nas tabelas

### Frontend:
- [ ] Criar hook `useTasksRealtime.ts`
- [ ] Criar componente `TaskOverdueNotification.tsx`
- [ ] Atualizar `useDailyTasks` para usar Realtime
- [ ] Integrar notificações no `LojaTasksCalendarView.tsx`
- [ ] Adicionar toasts para notificações em tempo real
- [ ] Testar atualização de status em tempo real

### Testes:
- [ ] Testar detecção de tarefas atrasadas
- [ ] Testar envio WhatsApp
- [ ] Testar notificações em tempo real (sem F5)
- [ ] Testar atualização de status em tempo real (sem F5)
- [ ] Testar performance com múltiplas lojas

---

**Documento criado em:** 2025-12-28  
**Status:** Plano completo, pronto para implementação

