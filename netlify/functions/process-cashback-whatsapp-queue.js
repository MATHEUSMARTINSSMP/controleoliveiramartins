/**
 * Netlify Function: Processar Fila de WhatsApp de Cashback
 * 
 * Esta função processa a fila de WhatsApp de cashback gerado
 * Pode ser chamada manualmente ou via cron job
 * 
 * Endpoint: /.netlify/functions/process-cashback-whatsapp-queue
 * Método: POST ou GET
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
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
    // Criar cliente Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Configuração Supabase não encontrada',
        }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'sistemaretiradas',
      },
    });

    console.log('[ProcessCashbackWhatsAppQueue] 🔄 Processando fila de WhatsApp de cashback...');

    // Buscar itens pendentes (máximo 10 por execução)
    const { data: queueItems, error: queueError } = await supabase
      .from('cashback_whatsapp_queue')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('[ProcessCashbackWhatsAppQueue] ❌ Erro ao buscar fila:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Nenhum item pendente na fila',
          processed: 0,
        }),
      };
    }

    console.log(`[ProcessCashbackWhatsAppQueue] 📋 ${queueItems.length} item(ns) encontrado(s) na fila`);

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Processar cada item da fila
    for (const item of queueItems) {
      try {
        // Marcar como PROCESSING
        await supabase
          .from('cashback_whatsapp_queue')
          .update({
            status: 'PROCESSING',
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Chamar a função send-cashback-whatsapp para enviar
        const netlifyUrl = process.env.URL || 'https://eleveaone.com.br';
        const functionUrl = `${netlifyUrl}/.netlify/functions/send-cashback-whatsapp`;

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_id: item.transaction_id,
            cliente_id: item.cliente_id,
            store_id: item.store_id,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Sucesso
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SENT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          sent++;
          console.log(`[ProcessCashbackWhatsAppQueue] ✅ WhatsApp enviado para transação ${item.transaction_id}`);
        } else if (result.skipped) {
          // Cliente sem telefone - marcar como SKIPPED
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: result.error || 'Cliente sem telefone',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          skipped++;
          console.log(`[ProcessCashbackWhatsAppQueue] ⏭️ WhatsApp pulado para transação ${item.transaction_id}: ${result.error}`);
        } else {
          // Falha
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: item.attempts >= 2 ? 'FAILED' : 'PENDING', // Tentar até 3 vezes
              error_message: result.error || 'Erro desconhecido',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          failed++;
          console.error(`[ProcessCashbackWhatsAppQueue] ❌ Falha ao enviar WhatsApp para transação ${item.transaction_id}: ${result.error}`);
        }

        processed++;
      } catch (itemError) {
        console.error(`[ProcessCashbackWhatsAppQueue] ❌ Erro ao processar item ${item.id}:`, itemError);
        
        // Marcar como falha após 3 tentativas
        await supabase
          .from('cashback_whatsapp_queue')
          .update({
            status: item.attempts >= 2 ? 'FAILED' : 'PENDING',
            error_message: itemError.message || String(itemError),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        failed++;
        processed++;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Fila processada',
        processed,
        sent,
        skipped,
        failed,
      }),
    };
  } catch (error) {
    console.error('[ProcessCashbackWhatsAppQueue] ❌ Erro:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
    };
  }
};

