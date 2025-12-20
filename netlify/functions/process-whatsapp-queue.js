/**
 * Netlify Function: Processar Fila de WhatsApp com Prioridades
 * 
 * Esta função processa mensagens da fila unificada respeitando prioridades
 * Mensagens de campanha (prioridade 7-10) NÃO bloqueiam outras mensagens (1-6)
 * 
 * Endpoint: /.netlify/functions/process-whatsapp-queue
 * 
 * Prioridades:
 * - 1-3: Crítico (cashback, notificações urgentes)
 * - 4-6: Normal (notificações, avisos de ponto)
 * - 7-10: Campanhas (envio em massa)
 */

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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Supabase configuration missing' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    });

    const startTime = new Date();
    console.log(`[ProcessWhatsAppQueue] 🔄 Iniciando processamento da fila... [${startTime.toISOString()}]`);

    // Buscar próximas mensagens (respeitando prioridades via função do banco)
    const { data: queueItems, error: queueError } = await supabase
      .rpc('get_next_whatsapp_messages', { p_limit: 50 });

    if (queueError) {
      console.error('[ProcessWhatsAppQueue] ❌ Erro ao buscar fila:', queueError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Failed to fetch queue',
          details: queueError.message 
        }),
      };
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[ProcessWhatsAppQueue] ✅ Nenhuma mensagem na fila');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true,
          processed: 0,
          message: 'No messages in queue'
        }),
      };
    }

    console.log(`[ProcessWhatsAppQueue] 📋 ${queueItems.length} mensagem(ns) encontrada(s) na fila`);

    const netlifyUrl = process.env.URL || process.env.NETLIFY_URL || 'https://eleveaone.com.br';
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Processar cada mensagem
    for (const item of queueItems) {
      try {
        // Buscar item completo da fila para verificar limites e obter metadados da campanha
        const { data: queueItem, error: queueItemError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_message_queue')
          .select('max_per_day_per_contact, max_total_per_day, interval_seconds, retry_count, max_retries, campaign_id, message_type')
          .eq('id', item.queue_id)
          .single();

        if (queueItemError || !queueItem) {
          console.error(`[ProcessWhatsAppQueue] ❌ Erro ao buscar item da fila ${item.queue_id}:`, queueItemError);
          failed++;
          continue;
        }

        // Verificar limites antes de enviar
        // 1. Limite por contato por dia
        if (queueItem.max_per_day_per_contact) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          todayStart.setHours(todayStart.getHours() - 3); // UTC-3

          const { count: sentTodayCount } = await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_message_queue')
            .select('*', { count: 'exact', head: true })
            .eq('phone', item.phone)
            .eq('store_id', item.store_id)
            .eq('status', 'SENT')
            .gte('sent_at', todayStart.toISOString());

          if (sentTodayCount && sentTodayCount >= queueItem.max_per_day_per_contact) {
            console.log(`[ProcessWhatsAppQueue] ⏭️ Limite diário atingido para ${item.phone} (${sentTodayCount}/${queueItem.max_per_day_per_contact})`);
            
            await supabase
              .schema('sistemaretiradas')
              .from('whatsapp_message_queue')
              .update({ 
                status: 'CANCELLED',
                error_message: `Limite diário atingido: ${sentTodayCount}/${queueItem.max_per_day_per_contact}`
              })
              .eq('id', item.queue_id);

            skipped++;
            continue;
          }
        }

        // 2. Limite total por dia (se configurado)
        if (queueItem.max_total_per_day) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          todayStart.setHours(todayStart.getHours() - 3); // UTC-3

          const { count: totalSentToday } = await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_message_queue')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', item.store_id)
            .eq('status', 'SENT')
            .gte('sent_at', todayStart.toISOString());

          if (totalSentToday && totalSentToday >= queueItem.max_total_per_day) {
            console.log(`[ProcessWhatsAppQueue] ⏭️ Limite total diário atingido para loja (${totalSentToday}/${queueItem.max_total_per_day})`);
            skipped++;
            continue;
          }
        }

        // Marcar como enviando
        await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_message_queue')
          .update({ status: 'SENDING' })
          .eq('id', item.queue_id);

        // Chamar função de envio
        // IMPORTANTE: Passar campaign_id e message_type para validação rigorosa
        // A função send-whatsapp-message só aceitará whatsapp_account_id se for campanha válida
        const sendMessageUrl = `${netlifyUrl}/.netlify/functions/send-whatsapp-message`;
        
        const payload = {
          phone: item.phone,
          message: item.message,
          store_id: item.store_id,
        };
        
        // Só passar whatsapp_account_id, campaign_id e message_type se realmente for campanha
        // Isso garante que números reserva só sejam usados em campanhas
        if (item.campaign_id && item.message_type === 'CAMPAIGN') {
          payload.whatsapp_account_id = item.whatsapp_account_id;
          payload.campaign_id = item.campaign_id;
          payload.message_type = item.message_type;
        }
        
        const response = await fetch(sendMessageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          // Erro ao enviar
          await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_message_queue')
            .update({ 
              status: 'FAILED',
              error_message: result.error || result.message || 'Erro desconhecido',
              retry_count: (queueItem.retry_count || 0) + 1
            })
            .eq('id', item.queue_id);

          console.error(`[ProcessWhatsAppQueue] ❌ Falha ao enviar mensagem ${item.queue_id}:`, result.error || result.message);
          failed++;
        } else {
          // Sucesso
          await supabase
            .schema('sistemaretiradas')
            .from('whatsapp_message_queue')
            .update({ 
              status: 'SENT',
              sent_at: new Date().toISOString()
            })
            .eq('id', item.queue_id);

          // Atualizar contador da campanha se aplicável
          if (item.campaign_id) {
            await supabase
              .schema('sistemaretiradas')
              .rpc('increment_campaign_sent_count', { p_campaign_id: item.campaign_id });
          }

          console.log(`[ProcessWhatsAppQueue] ✅ Mensagem ${item.queue_id} enviada com sucesso`);
          processed++;

          // Aplicar intervalo se configurado
          if (queueItem.interval_seconds && queueItem.interval_seconds > 0) {
            await new Promise(resolve => setTimeout(resolve, queueItem.interval_seconds * 1000));
          }
        }

      } catch (itemError) {
        console.error(`[ProcessWhatsAppQueue] ❌ Erro ao processar item ${item.queue_id}:`, itemError);
        
        await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_message_queue')
          .update({ 
            status: 'FAILED',
            error_message: itemError.message,
            retry_count: (queueItem?.retry_count || 0) + 1
          })
          .eq('id', item.queue_id);

        failed++;
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log(`[ProcessWhatsAppQueue] ✅ Processamento concluído em ${duration.toFixed(2)}s`);
    console.log(`[ProcessWhatsAppQueue] 📊 Processadas: ${processed}, Falhas: ${failed}, Puladas: ${skipped}`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true,
        processed,
        failed,
        skipped,
        total: queueItems.length,
        duration: duration.toFixed(2)
      }),
    };

  } catch (error) {
    console.error('[ProcessWhatsAppQueue] ❌ Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};

