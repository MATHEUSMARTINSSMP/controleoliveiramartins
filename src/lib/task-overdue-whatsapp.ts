/**
 * Serviço para enviar WhatsApp automático quando tarefas estão atrasadas
 * 
 * IMPORTANTE: Este serviço deve ser chamado apenas de:
 * - Supabase Edge Functions (cron job)
 * - Endpoints de backend autenticados
 * 
 * NÃO deve ser chamado diretamente do cliente para evitar vazamento de dados
 * entre tenants e ações não autorizadas.
 * 
 * REGRAS DE ENVIO:
 * - Sempre usa número GLOBAL como remetente (não passa store_id)
 * - Configuração de notificações em whatsapp_notifications (notification_type = 'TAREFAS_ATRASADAS')
 * - Destinatário: phone da config ou stores.whatsapp se use_global_whatsapp = true
 * 
 * CONFIGURAÇÃO:
 * - Edge Functions devem criar um cliente Supabase com service_role key
 * - Passar o cliente como parâmetro para as funções exportadas
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface TasksNotificationConfig {
    store_id: string;
    phone: string | null;
    active: boolean;
    use_global_whatsapp: boolean;
}

interface OverdueTask {
    id: string;
    title: string;
    due_time: string;
    store_id: string;
    store_name: string;
    store_whatsapp?: string;
    notifications_enabled: boolean;
}

interface SendOverdueNotificationResult {
    success: boolean;
    notificationsSent: number;
    storesSkipped: number;
    errors: string[];
}

interface WhatsAppSendResult {
    success: boolean;
    error?: string;
}

/**
 * Busca configurações de notificação de tarefas de whatsapp_notifications
 * 
 * @param supabase - Cliente Supabase com service_role key (para Edge Functions)
 */
async function getTasksNotificationConfigs(
    supabase: SupabaseClient
): Promise<Map<string, TasksNotificationConfig>> {
    const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('whatsapp_notifications')
        .select('store_id, phone, active, use_global_whatsapp')
        .eq('notification_type', 'TAREFAS_ATRASADAS')
        .eq('active', true);

    if (error) {
        console.error('[task-overdue-whatsapp] Erro ao buscar configs:', error);
        return new Map();
    }

    const configMap = new Map<string, TasksNotificationConfig>();
    for (const config of data || []) {
        if (config.store_id) {
            configMap.set(config.store_id, {
                store_id: config.store_id,
                phone: config.phone,
                active: config.active,
                use_global_whatsapp: config.use_global_whatsapp
            });
        }
    }
    return configMap;
}

/**
 * Busca tarefas atrasadas do dia que ainda não tiveram notificação WhatsApp enviada
 * Apenas para lojas com notificações ativas em whatsapp_notifications
 * 
 * @param supabase - Cliente Supabase com service_role key (para Edge Functions)
 */
export async function getOverdueTasksForNotification(
    supabase: SupabaseClient
): Promise<OverdueTask[]> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const notificationConfigs = await getTasksNotificationConfigs(supabase);

        const { data, error } = await supabase
            .schema('sistemaretiradas')
            .from('daily_tasks')
            .select(`
                id,
                title,
                due_time,
                store_id,
                stores!inner(
                    name,
                    whatsapp
                )
            `)
            .eq('is_active', true)
            .not('due_time', 'is', null)
            .lt('due_time', currentTime);

        if (error) throw error;

        const overdueTasks: OverdueTask[] = [];

        for (const task of data || []) {
            const config = notificationConfigs.get(task.store_id);
            const notificationsEnabled = config?.active ?? false;

            const { data: execution } = await supabase
                .schema('sistemaretiradas')
                .from('daily_task_executions')
                .select('id')
                .eq('task_id', task.id)
                .eq('execution_date', today)
                .not('completed_at', 'is', null)
                .limit(1);

            if (!execution || execution.length === 0) {
                const { data: notification } = await supabase
                    .schema('sistemaretiradas')
                    .from('task_overdue_notifications')
                    .select('id')
                    .eq('task_id', task.id)
                    .eq('notification_date', today)
                    .eq('whatsapp_sent', true)
                    .limit(1);

                if (!notification || notification.length === 0) {
                    const store = task.stores as unknown as { 
                        name: string; 
                        whatsapp?: string;
                    };
                    
                    let destinationPhone = store?.whatsapp;
                    if (config && !config.use_global_whatsapp && config.phone) {
                        destinationPhone = config.phone;
                    }

                    overdueTasks.push({
                        id: task.id,
                        title: task.title,
                        due_time: task.due_time!,
                        store_id: task.store_id,
                        store_name: store?.name || 'Loja',
                        store_whatsapp: destinationPhone,
                        notifications_enabled: notificationsEnabled
                    });
                }
            }
        }

        return overdueTasks;
    } catch (error) {
        console.error('[task-overdue-whatsapp] Erro ao buscar tarefas atrasadas:', error);
        return [];
    }
}

/**
 * Formata mensagem de WhatsApp para tarefas atrasadas
 */
export function formatOverdueWhatsAppMessage(
    storeName: string,
    tasks: OverdueTask[]
): string {
    const tasksList = tasks
        .map(t => `- ${t.title} (prazo: ${t.due_time})`)
        .join('\n');

    return `*Sistema de Tarefas - Aviso de Atraso*\n\n` +
        `Ola ${storeName}!\n\n` +
        `As seguintes tarefas estao atrasadas:\n\n` +
        `${tasksList}\n\n` +
        `Por favor, verifique e conclua as tarefas pendentes o mais rapido possivel.\n\n` +
        `_Mensagem automatica do Sistema EleveaOne_`;
}

/**
 * Registra que a notificação WhatsApp foi enviada
 * 
 * @param supabase - Cliente Supabase com service_role key
 */
async function markNotificationAsSent(
    supabase: SupabaseClient,
    taskId: string, 
    storeId: string
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        await supabase
            .schema('sistemaretiradas')
            .from('task_overdue_notifications')
            .upsert({
                task_id: taskId,
                store_id: storeId,
                notification_date: today,
                status: 'SENT',
                whatsapp_sent: true,
                whatsapp_sent_at: new Date().toISOString()
            }, {
                onConflict: 'task_id,notification_date'
            });
    } catch (error) {
        console.error('[task-overdue-whatsapp] Erro ao marcar notificação:', error);
    }
}

/**
 * Processa e envia notificações WhatsApp para todas as lojas com tarefas atrasadas
 * 
 * IMPORTANTE: 
 * - Esta função deve ser chamada apenas de Edge Functions ou backend
 * - Sempre envia pelo número GLOBAL (não passa store_id)
 * - Configuração vem de whatsapp_notifications (notification_type = 'TAREFAS_ATRASADAS')
 * - Destinatário: phone da config ou stores.whatsapp se use_global_whatsapp = true
 * 
 * @param supabase - Cliente Supabase com service_role key (para bypass RLS)
 * @param sendWhatsApp - Função para enviar WhatsApp (injetada pelo chamador)
 */
export async function processOverdueTaskNotifications(
    supabase: SupabaseClient,
    sendWhatsApp: (phone: string, message: string) => Promise<WhatsAppSendResult>
): Promise<SendOverdueNotificationResult> {
    const result: SendOverdueNotificationResult = {
        success: true,
        notificationsSent: 0,
        storesSkipped: 0,
        errors: []
    };

    try {
        const overdueTasks = await getOverdueTasksForNotification(supabase);
        
        if (overdueTasks.length === 0) {
            console.log('[task-overdue-whatsapp] Nenhuma tarefa atrasada para notificar');
            return result;
        }

        const tasksByStore = overdueTasks.reduce((acc, task) => {
            if (!acc[task.store_id]) {
                acc[task.store_id] = {
                    storeName: task.store_name,
                    storeWhatsapp: task.store_whatsapp,
                    notificationsEnabled: task.notifications_enabled,
                    tasks: []
                };
            }
            acc[task.store_id].tasks.push(task);
            return acc;
        }, {} as Record<string, { 
            storeName: string; 
            storeWhatsapp?: string; 
            notificationsEnabled: boolean;
            tasks: OverdueTask[] 
        }>);

        for (const [storeId, data] of Object.entries(tasksByStore)) {
            if (!data.notificationsEnabled) {
                console.log(`[task-overdue-whatsapp] Loja ${data.storeName} tem notificações desativadas, pulando...`);
                result.storesSkipped++;
                continue;
            }

            if (!data.storeWhatsapp) {
                result.errors.push(`Loja ${data.storeName} nao tem WhatsApp cadastrado (campo 'whatsapp')`);
                continue;
            }

            const message = formatOverdueWhatsAppMessage(data.storeName, data.tasks);
            
            const whatsappResult = await sendWhatsApp(data.storeWhatsapp, message);

            if (whatsappResult.success) {
                result.notificationsSent++;
                console.log(`[task-overdue-whatsapp] Notificacao enviada para ${data.storeName} (${data.storeWhatsapp})`);
                for (const task of data.tasks) {
                    await markNotificationAsSent(supabase, task.id, storeId);
                }
            } else {
                result.errors.push(`Falha ao enviar WhatsApp para ${data.storeName}: ${whatsappResult.error}`);
            }
        }

        if (result.errors.length > 0) {
            result.success = false;
        }

        console.log(`[task-overdue-whatsapp] Resultado: ${result.notificationsSent} enviadas, ${result.storesSkipped} lojas puladas, ${result.errors.length} erros`);
        return result;
    } catch (error) {
        console.error('[task-overdue-whatsapp] Erro ao processar notificações:', error);
        return {
            success: false,
            notificationsSent: 0,
            storesSkipped: 0,
            errors: [(error as Error).message]
        };
    }
}

/**
 * Formata mensagem de tarefa atrasada para exibição (uso no frontend)
 */
export function formatOverdueTaskMessage(task: { title: string; due_time: string }): string {
    return `Tarefa "${task.title}" esta atrasada (prazo: ${task.due_time})`;
}
