/**
 * Componente para exibir notificações de tarefas atrasadas
 * Integra com Realtime para atualizações em tempo real
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface TaskOverdueNotification {
  id: string;
  task_id: string;
  store_id: string;
  notification_date: string;
  due_time: string;
  status: 'PENDING' | 'SENT' | 'READ' | 'DISMISSED';
  whatsapp_sent: boolean;
  whatsapp_sent_at?: string;
  read_at?: string;
  dismissed_at?: string;
  created_at: string;
  daily_tasks?: {
    id: string;
    title: string;
    description?: string;
  };
}

interface TaskOverdueNotificationProps {
  storeId: string | null;
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
}

export function TaskOverdueNotification({
  storeId,
  onMarkAsRead,
  onDismiss,
}: TaskOverdueNotificationProps) {
  const [notifications, setNotifications] = useState<TaskOverdueNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    // Configurar subscription Realtime para novas notificações
    const channel = supabase
      .channel(`task_overdue_notifications:store:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'sistemaretiradas',
          table: 'task_overdue_notifications',
          filter: `store_id=eq.${storeId},status=eq.PENDING`,
        },
        (payload) => {
          console.log('[TaskOverdueNotification] Nova notificação:', payload);
          const newNotification = payload.new as TaskOverdueNotification;
          setNotifications((prev) => {
            // Evitar duplicatas
            if (prev.some((n) => n.id === newNotification.id)) {
              return prev;
            }
            return [newNotification, ...prev];
          });
          showToast(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'sistemaretiradas',
          table: 'task_overdue_notifications',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('[TaskOverdueNotification] Notificação atualizada:', payload);
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.new.id ? (payload.new as TaskOverdueNotification) : n
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[TaskOverdueNotification] Subscribed to notifications');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  const fetchNotifications = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('task_overdue_notifications')
        .select(`
          *,
          daily_tasks (
            id,
            title,
            description
          )
        `)
        .eq('store_id', storeId)
        .in('status', ['PENDING', 'SENT'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications((data as TaskOverdueNotification[]) || []);
    } catch (error: any) {
      console.error('[TaskOverdueNotification] Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (notification: TaskOverdueNotification) => {
    const taskTitle = notification.daily_tasks?.title || 'Tarefa';
    toast.error(`⚠️ Tarefa Atrasada: ${taskTitle}`, {
      description: `Prazo: ${notification.due_time}`,
      duration: 10000,
      action: {
        label: 'Ver',
        onClick: () => handleMarkAsRead(notification.id),
      },
    });
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('task_overdue_notifications')
        .update({
          status: 'READ',
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );

      onMarkAsRead?.(notificationId);
    } catch (error: any) {
      console.error('[TaskOverdueNotification] Erro ao marcar como lida:', error);
      toast.error('Erro ao marcar notificação como lida');
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('task_overdue_notifications')
        .update({
          status: 'DISMISSED',
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );

      onDismiss?.(notificationId);
    } catch (error: any) {
      console.error('[TaskOverdueNotification] Erro ao descartar notificação:', error);
      toast.error('Erro ao descartar notificação');
    }
  };

  if (loading || notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <Alert
          key={notification.id}
          variant="destructive"
          className="border-orange-500 bg-orange-50 dark:bg-orange-950/20"
        >
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-100">
            Tarefa Atrasada
          </AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">
                  {notification.daily_tasks?.title || 'Tarefa sem título'}
                </p>
                {notification.daily_tasks?.description && (
                  <p className="text-sm mt-1 opacity-90">
                    {notification.daily_tasks.description}
                  </p>
                )}
                <p className="text-xs mt-1">
                  Prazo: <span className="font-semibold">{notification.due_time}</span>
                </p>
                {notification.whatsapp_sent && (
                  <p className="text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    WhatsApp enviado
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkAsRead(notification.id)}
                  className="h-8 px-2 text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-100"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(notification.id)}
                  className="h-8 px-2 text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:text-orange-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

