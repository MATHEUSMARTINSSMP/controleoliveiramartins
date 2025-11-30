// Supabase Edge Function: Processar Fila de WhatsApp de Cashback
// Esta função processa a fila de WhatsApp de cashback automaticamente
// Pode ser chamada via Scheduled Job do Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuração Supabase não encontrada',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    })

    console.log('[ProcessCashbackQueue] 🔄 Processando fila de WhatsApp de cashback...')

    // Buscar itens pendentes (máximo 10 por execução)
    const { data: queueItems, error: queueError } = await supabase
      .from('cashback_whatsapp_queue')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(10)

    if (queueError) {
      console.error('[ProcessCashbackQueue] ❌ Erro ao buscar fila:', queueError)
      throw queueError
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum item pendente na fila',
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[ProcessCashbackQueue] 📋 ${queueItems.length} item(ns) encontrado(s) na fila`)

    // Obter URL do Netlify da configuração
    const { data: netlifyConfig } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'netlify_url')
      .single()

    const netlifyUrl = netlifyConfig?.value || 'https://eleveaone.com.br'
    const sendFunctionUrl = `${netlifyUrl}/.netlify/functions/send-cashback-whatsapp`

    let processed = 0
    let sent = 0
    let failed = 0
    let skipped = 0

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
          .eq('id', item.id)

        // Chamar a função send-cashback-whatsapp para enviar
        const response = await fetch(sendFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transaction_id: item.transaction_id,
            cliente_id: item.cliente_id,
            store_id: item.store_id,
          }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          // Sucesso
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SENT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          sent++
          console.log(`[ProcessCashbackQueue] ✅ WhatsApp enviado para transação ${item.transaction_id}`)
        } else if (result.skipped) {
          // Cliente sem telefone - marcar como SKIPPED
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: result.error || 'Cliente sem telefone',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          skipped++
          console.log(`[ProcessCashbackQueue] ⏭️ WhatsApp pulado para transação ${item.transaction_id}: ${result.error}`)
        } else {
          // Falha
          const newStatus = item.attempts >= 2 ? 'FAILED' : 'PENDING' // Tentar até 3 vezes

          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: newStatus,
              error_message: result.error || 'Erro desconhecido',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          if (newStatus === 'FAILED') {
            failed++
            console.log(`[ProcessCashbackQueue] ❌ WhatsApp falhou após 3 tentativas para transação ${item.transaction_id}`)
          } else {
            console.log(`[ProcessCashbackQueue] ⚠️ Tentativa ${item.attempts + 1} falhou, tentando novamente: ${result.error}`)
          }
        }

        processed++
      } catch (itemError) {
        console.error(`[ProcessCashbackQueue] ❌ Erro ao processar item ${item.id}:`, itemError)

        // Marcar como PENDING novamente se não excedeu tentativas
        if (item.attempts < 2) {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'PENDING',
              error_message: String(itemError),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        } else {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'FAILED',
              error_message: String(itemError),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
          failed++
        }
      }
    }

    console.log(`[ProcessCashbackQueue] ✅ Processamento concluído: ${sent} enviadas, ${skipped} puladas, ${failed} falhadas`)

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        skipped,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[ProcessCashbackQueue] ❌ Erro fatal:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

