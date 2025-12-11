import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  storeId: string | undefined,
  netlifyUrl: string,
  useGlobalWhatsApp?: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${netlifyUrl}/.netlify/functions/send-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        message,
        ...(storeId && { store_id: storeId }),
        ...(useGlobalWhatsApp !== undefined && { use_global_whatsapp: useGlobalWhatsApp }),
      }),
    })

    const responseText = await response.text()
    let responseData: any
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = { message: responseText, raw: responseText }
    }

    if (!response.ok) {
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    console.log('[ProcessTimeClockNotifications] Processando fila...')

    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'netlify_url')
      .single()

    const netlifyUrl = config?.value || 'https://eleveaone.com.br'

    const { data: queueItems, error: queueError } = await supabase
      .from('time_clock_notification_queue')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(50)

    // Buscar configuração de uso de WhatsApp global para cada loja única
    const storeIds = [...new Set(queueItems?.map(item => item.store_id) || [])]
    const configsMap = new Map<string, boolean>()
    
    if (storeIds.length > 0) {
      const { data: configs } = await supabase
        .from('time_clock_notification_config')
        .select('store_id, use_global_whatsapp')
        .in('store_id', storeIds)
      
      configs?.forEach(config => {
        configsMap.set(config.store_id, config.use_global_whatsapp ?? false)
      })
    }

    if (queueError) {
      console.error('[ProcessTimeClockNotifications] Erro ao buscar fila:', queueError)
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

    console.log(`[ProcessTimeClockNotifications] ${queueItems.length} item(ns) encontrado(s)`)

    let processed = 0
    let sent = 0
    let failed = 0

    for (const item of queueItems) {
      try {
        if (!item.phone || item.phone.trim() === '') {
          await supabase
            .from('time_clock_notification_queue')
            .update({
              status: 'FAILED',
              error_message: 'Telefone vazio',
              attempts: (item.attempts || 0) + 1,
            })
            .eq('id', item.id)

          failed++
          processed++
          continue
        }

        const useGlobalWhatsApp = configsMap.get(item.store_id) ?? false
        
        // Se escolheu usar Global, não passar store_id (mesma lógica da notificação de venda)
        const storeIdToUse = useGlobalWhatsApp ? undefined : item.store_id
        
        const sendResult = await sendWhatsAppMessage(
          item.phone,
          item.message,
          storeIdToUse,
          netlifyUrl,
          useGlobalWhatsApp
        )

        if (sendResult.success) {
          await supabase
            .from('time_clock_notification_queue')
            .update({
              status: 'SENT',
              sent_at: new Date().toISOString(),
              attempts: (item.attempts || 0) + 1,
            })
            .eq('id', item.id)

          sent++
          console.log(`[ProcessTimeClockNotifications] WhatsApp enviado: ${item.phone}`)
        } else {
          const newAttempts = (item.attempts || 0) + 1
          const newStatus = newAttempts >= 3 ? 'FAILED' : 'PENDING'

          await supabase
            .from('time_clock_notification_queue')
            .update({
              status: newStatus,
              error_message: sendResult.error || 'Erro desconhecido',
              attempts: newAttempts,
            })
            .eq('id', item.id)

          if (newStatus === 'FAILED') {
            failed++
          }
        }

        processed++
      } catch (itemError: any) {
        console.error(`[ProcessTimeClockNotifications] Erro ao processar item ${item.id}:`, itemError)

        const newAttempts = (item.attempts || 0) + 1
        const newStatus = newAttempts >= 3 ? 'FAILED' : 'PENDING'

        await supabase
          .from('time_clock_notification_queue')
          .update({
            status: newStatus,
            error_message: itemError.message || String(itemError),
            attempts: newAttempts,
          })
          .eq('id', item.id)

        if (newStatus === 'FAILED') {
          failed++
        }
        processed++
      }
    }

    console.log(`[ProcessTimeClockNotifications] Concluído: ${sent} enviadas, ${failed} falhadas`)

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('[ProcessTimeClockNotifications] Erro fatal:', error)
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
