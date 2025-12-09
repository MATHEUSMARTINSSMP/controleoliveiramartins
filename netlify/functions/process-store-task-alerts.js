const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { db: { schema: 'sistemaretiradas' } }
    );

    console.log('[process-store-task-alerts] Iniciando processamento de alertas...');

    // Buscar mensagens pendentes na fila
    const { data: queueItems, error: queueError } = await supabaseAdmin
      .schema('sistemaretiradas')
      .from('store_notification_queue')
      .select(`
        *,
        store_notifications!store_notification_queue_notification_id_fkey (
          *,
          stores!store_notifications_store_id_fkey (
            *
          )
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(50);

    if (queueError) {
      console.error('[process-store-task-alerts] Erro ao buscar fila:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[process-store-task-alerts] Nenhuma mensagem pendente na fila');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({
          success: true,
          message: 'Nenhuma mensagem pendente',
          processed: 0
        }),
      };
    }

    console.log(`[process-store-task-alerts] ${queueItems.length} mensagens pendentes encontradas`);

    let successCount = 0;
    let errorCount = 0;

    // Processar cada mensagem
    for (const item of queueItems) {
      try {
        const notification = Array.isArray(item.store_notifications) 
          ? item.store_notifications[0] 
          : item.store_notifications;
        const store = Array.isArray(notification?.stores) 
          ? notification?.stores[0] 
          : notification?.stores;

        if (!notification || !store) {
          console.error(`[process-store-task-alerts] Item ${item.id} sem notificação ou loja`);
          await supabaseAdmin
            .schema('sistemaretiradas')
            .from('store_notification_queue')
            .update({ status: 'FAILED', error_message: 'Notificação ou loja não encontrada' })
            .eq('id', item.id);
          errorCount++;
          continue;
        }

        // Enviar via WhatsApp usando a função send-whatsapp-message
        const whatsappUrl = process.env.NETLIFY_FUNCTIONS_URL 
          ? `${process.env.NETLIFY_FUNCTIONS_URL}/.netlify/functions/send-whatsapp-message`
          : 'https://eleveaone.com.br/.netlify/functions/send-whatsapp-message';

        const whatsappResponse = await fetch(whatsappUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: item.phone,
            message: item.message,
            store_id: store.id
          })
        });

        const whatsappData = await whatsappResponse.json();

        if (whatsappData.success) {
          // Atualizar status para SENT
          await supabaseAdmin
            .schema('sistemaretiradas')
            .from('store_notification_queue')
            .update({ 
              status: 'SENT', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', item.id);
          
          successCount++;
          console.log(`[process-store-task-alerts] ✅ Mensagem ${item.id} enviada com sucesso`);
        } else {
          // Atualizar status para FAILED
          await supabaseAdmin
            .schema('sistemaretiradas')
            .from('store_notification_queue')
            .update({ 
              status: 'FAILED', 
              error_message: whatsappData.error || 'Erro desconhecido',
              retry_count: (item.retry_count || 0) + 1
            })
            .eq('id', item.id);
          
          errorCount++;
          console.error(`[process-store-task-alerts] ❌ Erro ao enviar mensagem ${item.id}:`, whatsappData.error);
        }
      } catch (error) {
        console.error(`[process-store-task-alerts] ❌ Erro ao processar item ${item.id}:`, error);
        await supabaseAdmin
          .schema('sistemaretiradas')
          .from('store_notification_queue')
          .update({ 
            status: 'FAILED', 
            error_message: error.message || 'Erro desconhecido',
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);
        errorCount++;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        message: 'Processamento concluído',
        processed: queueItems.length,
        success: successCount,
        errors: errorCount
      }),
    };
  } catch (error) {
    console.error('[process-store-task-alerts] Erro:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro ao processar alertas'
      }),
    };
  }
};

