/**
 * Netlify Function: Verificar Tarefas Atrasadas
 * 
 * Cron job que verifica tarefas que entraram em atraso e:
 * 1. Cria notificações na tabela task_overdue_notifications
 * 2. Envia notificação via WhatsApp (número global) para o número da loja
 * 
 * Execução: A cada 1 minuto (via cron)
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Validar variáveis de ambiente
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[task-check-overdue] Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Configuração do servidor incompleta',
        }),
      };
    }

    // Validar secret key (se fornecido via header ou query)
    const secretKey = event.headers['x-secret-key'] || event.queryStringParameters?.secret;
    const expectedSecret = process.env.TASK_CHECK_SECRET || process.env.CRON_SECRET;
    
    if (expectedSecret && secretKey !== expectedSecret) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
      };
    }

    // Inicializar Supabase Admin
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: { schema: 'sistemaretiradas' },
      }
    );

    // Obter data e hora atual
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    console.log(`[task-check-overdue] Verificando tarefas atrasadas - Data: ${currentDate}, Hora: ${currentTime}`);

    // Detectar tarefas atrasadas
    const { data: overdueTasks, error: detectError } = await supabase
      .rpc('detect_overdue_tasks', {
        p_current_date: currentDate,
        p_current_time: currentTime,
      });

    if (detectError) {
      console.error('[task-check-overdue] Erro ao detectar tarefas atrasadas:', detectError);
      throw detectError;
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log('[task-check-overdue] Nenhuma tarefa atrasada encontrada');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No overdue tasks',
          overdue_count: 0,
          processed: 0,
        }),
      };
    }

    console.log(`[task-check-overdue] Encontradas ${overdueTasks.length} tarefa(s) atrasada(s)`);

    // Processar cada tarefa atrasada
    const results = [];
    for (const task of overdueTasks) {
      try {
        // 1. Criar notificação
        const { data: notificationId, error: notifError } = await supabase
          .rpc('create_overdue_notification', {
            p_task_id: task.task_id,
            p_store_id: task.store_id,
            p_notification_date: currentDate,
            p_due_time: task.due_time,
          });

        if (notifError) {
          console.error(`[task-check-overdue] Erro ao criar notificação para tarefa ${task.task_id}:`, notifError);
          continue;
        }

        if (!notificationId) {
          console.log(`[task-check-overdue] Notificação já existe para tarefa ${task.task_id} em ${currentDate}`);
          continue; // Já foi notificado hoje
        }

        // 2. Buscar informações da loja (nome e telefone WhatsApp)
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('id, name, whatsapp')
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

            // Chamar função de envio WhatsApp (número global)
            const netlifyUrl = process.env.NETLIFY_URL || 'https://eleveaone.com.br';
            const whatsappResponse = await fetch(`${netlifyUrl}/.netlify/functions/send-whatsapp-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NETLIFY_FUNCTION_SECRET || ''}`,
              },
              body: JSON.stringify({
                phone: store.whatsapp,
                message: whatsappMessage,
                store_id: store.id,
                useGlobalWhatsApp: true, // Forçar uso de número global
              }),
            });

            const whatsappData = await whatsappResponse.json();

            if (whatsappResponse.ok && whatsappData.success) {
              console.log(`[task-check-overdue] WhatsApp enviado para loja ${store.name} (${store.whatsapp})`);

              // Atualizar notificação como enviada
              await supabase
                .from('task_overdue_notifications')
                .update({
                  whatsapp_sent: true,
                  whatsapp_sent_at: new Date().toISOString(),
                  status: 'SENT',
                })
                .eq('id', notificationId);
            } else {
              console.error(`[task-check-overdue] Erro ao enviar WhatsApp:`, whatsappData.error || 'Unknown error');
            }

          } catch (whatsappError) {
            console.error(`[task-check-overdue] Exceção ao enviar WhatsApp:`, whatsappError);
            // Continuar mesmo se WhatsApp falhar
          }
        } else {
          console.log(`[task-check-overdue] Loja ${store.name} não tem WhatsApp configurado`);
        }

        results.push({
          task_id: task.task_id,
          store_id: task.store_id,
          store_name: store.name,
          notification_id: notificationId,
          whatsapp_sent: !!store.whatsapp && whatsappResponse?.ok,
        });

      } catch (taskError) {
        console.error(`[task-check-overdue] Erro ao processar tarefa ${task.task_id}:`, taskError);
        // Continuar com próxima tarefa
      }
    }

    console.log(`[task-check-overdue] Processadas ${results.length} tarefa(s) atrasada(s)`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        overdue_count: overdueTasks.length,
        processed: results.length,
        results,
      }),
    };

  } catch (error) {
    console.error('[task-check-overdue] Erro geral:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao processar tarefas atrasadas',
      }),
    };
  }
};

