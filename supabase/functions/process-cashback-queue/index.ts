// Supabase Edge Function: Processar Fila de WhatsApp de Cashback
// Esta função processa a fila de WhatsApp de cashback automaticamente
// Usa a mesma lógica de envio de WhatsApp que já existe no sistema (send-whatsapp-message.js)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para normalizar telefone para WhatsApp (DDI + DDD + número)
function normalizePhone(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  let cleaned = phoneNumber.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }
  
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return cleaned
  }
  
  if (cleaned.startsWith('55') && cleaned.length > 13) {
    cleaned = cleaned.substring(2)
  }
  
  if (cleaned.length < 10 || cleaned.length > 11) {
    console.warn(`[normalizePhone] Telefone com tamanho inválido: ${cleaned.length} dígitos`)
    if (cleaned.length < 10) {
      return cleaned
    }
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }
  
  // Verificar 9 duplicado
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    const nonoDoFinal = cleaned[cleaned.length - 9]
    const decimoDoFinal = cleaned[cleaned.length - 10]
    if (nonoDoFinal === '9' && decimoDoFinal === '9') {
      const antes = cleaned.substring(0, cleaned.length - 9)
      const depois = cleaned.substring(cleaned.length - 8)
      cleaned = antes + depois
      console.log(`[normalizePhone] Removido 9 extra: ${phoneNumber} -> ${cleaned}`)
    }
  }
  
  return cleaned
}

// Função para gerar slug a partir do nome da loja
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
    .replace(/_+/g, '_')
}

// Função para formatar mensagem de cashback
function formatCashbackMessage(params: {
  clienteNome: string
  storeName: string
  cashbackAmount: number
  dataExpiracao: string
  percentualUsoMaximo: number
  saldoAtual: number
}): string {
  const { clienteNome, storeName, cashbackAmount, dataExpiracao, percentualUsoMaximo, saldoAtual } = params
  
  const primeiroNome = clienteNome.split(' ')[0]
  
  const cashbackFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cashbackAmount)
  
  const saldoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(saldoAtual)
  
  const dataExpiracaoFormatada = new Date(dataExpiracao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  
  const percentualFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(percentualUsoMaximo / 100)
  
  let message = `🎁 *Cashback Gerado!*\n\n`
  message += `${primeiroNome},\n\n`
  message += `Obrigado pela sua compra na ${storeName}, nós somos muito gratos por ter você como nossa cliente.\n\n`
  message += `Você gerou ${cashbackFormatado} de cashback para você utilizar em nossa loja.\n\n`
  message += `Esse cashback é válido até o dia ${dataExpiracaoFormatada} e você poderá cobrir até ${percentualFormatado} do valor da sua próxima compra.\n\n`
  message += `Seu saldo atual é ${saldoFormatado}.\n\n`
  message += `Com carinho,\n${storeName}\n\n`
  message += `Sistema EleveaOne 📊`

  return message
}

// Buscar credencial GLOBAL do banco de dados
async function fetchGlobalCredential(supabase: SupabaseClient): Promise<{ siteSlug: string; customerId: string } | null> {
  try {
    console.log('[WhatsApp] Buscando credencial global (is_global = true)...')
    
    const { data: globalCred, error: globalError } = await supabase
      .from('whatsapp_credentials')
      .select('customer_id, site_slug, uazapi_status, display_name')
      .eq('is_global', true)
      .eq('status', 'active')
      .maybeSingle()

    if (globalError) {
      console.warn('[WhatsApp] Erro ao buscar credencial global:', globalError.message)
      return null
    }

    if (globalCred && globalCred.uazapi_status === 'connected') {
      console.log('[WhatsApp] Credencial global encontrada e conectada:', globalCred.display_name || 'Elevea Global')
      return {
        siteSlug: globalCred.site_slug,
        customerId: globalCred.customer_id,
      }
    }

    console.log('[WhatsApp] Credencial global não encontrada ou não conectada (status:', globalCred?.uazapi_status || 'não existe', ')')
    return null
  } catch (err: any) {
    console.warn('[WhatsApp] Erro ao buscar credencial global:', err.message)
    return null
  }
}

// Buscar credenciais da loja ou usar global como fallback
async function getWhatsAppCredentials(
  supabase: SupabaseClient,
  storeId: string,
  storeName: string
): Promise<{ siteSlug: string; customerId: string; source: string } | null> {
  try {
    // 1. Verificar se loja tem WhatsApp ativo
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, whatsapp_ativo')
      .eq('id', storeId)
      .single()

    if (storeError || !store) {
      console.log('[WhatsApp] Loja não encontrada, tentando credencial global...')
      const globalCred = await fetchGlobalCredential(supabase)
      if (globalCred) {
        return { ...globalCred, source: 'global_db (loja não encontrada)' }
      }
      return null
    }

    if (store.whatsapp_ativo === false) {
      console.log('[WhatsApp] Loja', store.name, 'tem whatsapp_ativo = false. Não enviando.')
      return null
    }

    // 2. Buscar admin da loja
    const storeSlug = generateSlug(store.name)
    
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('store_id', storeId)
      .eq('role', 'ADMIN')
      .maybeSingle()

    if (!adminError && adminProfile?.email) {
      const adminEmail = adminProfile.email
      console.log('[WhatsApp] Admin da loja encontrado:', adminEmail)

      // 3. Buscar credenciais PRÓPRIAS da loja
      const { data: storeCreds, error: credError } = await supabase
        .from('whatsapp_credentials')
        .select('customer_id, site_slug, uazapi_status, is_global')
        .eq('customer_id', adminEmail)
        .eq('site_slug', storeSlug)
        .eq('status', 'active')
        .maybeSingle()

      if (!credError && storeCreds && storeCreds.uazapi_status === 'connected' && !storeCreds.is_global) {
        console.log('[WhatsApp] Usando credenciais PRÓPRIAS da loja:', store.name)
        return {
          siteSlug: storeCreds.site_slug,
          customerId: storeCreds.customer_id,
          source: `loja:${store.name}`,
        }
      }
    }

    // 4. Fallback para credencial GLOBAL
    console.log('[WhatsApp] Loja', store.name, 'vai usar credencial GLOBAL (fallback)')
    const globalCred = await fetchGlobalCredential(supabase)
    if (globalCred) {
      return { ...globalCred, source: `global_db (loja: ${store.name})` }
    }

    return null
  } catch (err: any) {
    console.warn('[WhatsApp] Erro ao buscar credenciais:', err.message)
    const globalCred = await fetchGlobalCredential(supabase)
    if (globalCred) {
      return { ...globalCred, source: 'global_db (fallback erro)' }
    }
    return null
  }
}

// Função para enviar WhatsApp via webhook n8n
async function sendWhatsAppMessage(
  phone: string, 
  message: string,
  siteSlug: string,
  customerId: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    if (!phone || phone.trim() === '') {
      return { success: false, error: 'Telefone vazio', skipped: true }
    }

    const normalizedPhone = normalizePhone(phone)
    
    if (!normalizedPhone || normalizedPhone.length < 12) {
      return { success: false, error: `Telefone normalizado inválido: ${normalizedPhone}`, skipped: true }
    }
    
    const webhookUrl = Deno.env.get('WHATSAPP_WEBHOOK_URL') || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send'
    const webhookAuth = Deno.env.get('N8N_WEBHOOK_AUTH') || ''

    const messageEscaped = JSON.stringify(message)
    const messageSafe = messageEscaped.slice(1, -1)

    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phone_number: String(normalizedPhone),
      message: messageSafe,
    }

    console.log('[WhatsApp] Enviando para:', normalizedPhone)
    console.log('[WhatsApp] siteSlug:', siteSlug, '| customerId:', customerId)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (webhookAuth) {
      headers['x-app-key'] = webhookAuth
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let responseData: any
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = { message: responseText, raw: responseText }
    }

    console.log('[WhatsApp] Status:', response.status, '| Response:', JSON.stringify(responseData).substring(0, 200))

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
        JSON.stringify({ success: false, error: 'Configuração Supabase não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    })

    console.log('[ProcessCashbackQueue] 🔄 Processando fila de WhatsApp de cashback...')

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
        JSON.stringify({ success: true, message: 'Nenhum item pendente na fila', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[ProcessCashbackQueue] 📋 ${queueItems.length} item(ns) encontrado(s) na fila`)

    let processed = 0
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const item of queueItems) {
      try {
        await supabase
          .from('cashback_whatsapp_queue')
          .update({
            status: 'PROCESSING',
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        const { data: transaction, error: transactionError } = await supabase
          .from('cashback_transactions')
          .select('amount, data_expiracao')
          .eq('id', item.transaction_id)
          .eq('transaction_type', 'EARNED')
          .single()

        if (transactionError || !transaction) {
          throw new Error('Transação de cashback não encontrada')
        }

        // Usar dados da fila primeiro, depois buscar do banco
        let clienteNome = item.cliente_nome
        let clienteTelefone = item.cliente_telefone

        if (!clienteNome || !clienteTelefone) {
          const { data: tinyCliente } = await supabase
            .from('tiny_contacts')
            .select('nome, telefone')
            .eq('id', item.cliente_id)
            .single()

          if (tinyCliente) {
            clienteNome = clienteNome || tinyCliente.nome
            clienteTelefone = clienteTelefone || tinyCliente.telefone
          } else {
            const { data: crmCliente } = await supabase
              .from('crm_contacts')
              .select('nome, telefone')
              .eq('id', item.cliente_id)
              .single()

            if (crmCliente) {
              clienteNome = clienteNome || crmCliente.nome
              clienteTelefone = clienteTelefone || crmCliente.telefone
            }
          }
        }

        if (!clienteNome) {
          throw new Error('Cliente não encontrado')
        }

        if (!clienteTelefone || clienteTelefone.trim() === '') {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: 'Cliente não possui telefone cadastrado',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          skipped++
          console.log(`[ProcessCashbackQueue] ⏭️ WhatsApp pulado: cliente sem telefone (transação ${item.transaction_id})`)
          processed++
          continue
        }

        const telefoneLimpo = clienteTelefone.replace(/\D/g, '')
        if (telefoneLimpo.length < 10) {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: `Telefone inválido: ${clienteTelefone} (menos de 10 dígitos)`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          skipped++
          processed++
          continue
        }

        // Buscar dados da loja
        const { data: loja, error: lojaError } = await supabase
          .from('stores')
          .select('name')
          .eq('id', item.store_id)
          .single()

        if (lojaError || !loja) {
          throw new Error('Loja não encontrada')
        }

        // =====================================================================
        // BUSCAR CREDENCIAIS DO WHATSAPP (LOJA OU GLOBAL)
        // =====================================================================
        let credentials = await getWhatsAppCredentials(supabase, item.store_id, loja.name)
        
        if (!credentials) {
          // Fallback final: variáveis de ambiente
          const envSiteSlug = Deno.env.get('WHATSAPP_SITE_SLUG')
          const envCustomerId = Deno.env.get('N8N_CUSTOMER_ID')
          
          if (!envSiteSlug || !envCustomerId) {
            throw new Error('Nenhuma credencial WhatsApp disponível (banco ou env vars)')
          }
          
          console.log('[WhatsApp] Usando credenciais de variáveis de ambiente (fallback final)')
          credentials = {
            siteSlug: envSiteSlug,
            customerId: envCustomerId,
            source: 'env_vars'
          }
        }

        console.log(`[WhatsApp] Fonte das credenciais: ${credentials.source}`)

        // Buscar configurações de cashback
        const { data: settings } = await supabase
          .from('cashback_settings')
          .select('percentual_uso_maximo')
          .or(`store_id.is.null,store_id.eq.${item.store_id}`)
          .order('store_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        const percentualUsoMaximo = settings?.percentual_uso_maximo || 30.0

        // Buscar saldo atual
        const { data: saldo } = await supabase
          .from('cashback_balance')
          .select('balance, balance_disponivel, balance_pendente')
          .eq('cliente_id', item.cliente_id)
          .single()

        let saldoAtual = 0
        if (saldo) {
          saldoAtual = saldo.balance || ((saldo.balance_disponivel || 0) + (saldo.balance_pendente || 0))
        }
        
        if (saldoAtual === 0 && transaction.amount > 0) {
          saldoAtual = Number(transaction.amount)
        }

        // Formatar mensagem
        const message = formatCashbackMessage({
          clienteNome: clienteNome,
          storeName: loja.name,
          cashbackAmount: Number(transaction.amount),
          dataExpiracao: transaction.data_expiracao,
          percentualUsoMaximo: Number(percentualUsoMaximo),
          saldoAtual: Number(saldoAtual),
        })

        // Enviar WhatsApp com credenciais do banco
        const sendResult = await sendWhatsAppMessage(
          clienteTelefone, 
          message,
          credentials.siteSlug,
          credentials.customerId
        )

        if (sendResult.success) {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SENT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          sent++
          console.log(`[ProcessCashbackQueue] ✅ WhatsApp enviado para ${clienteNome} (${clienteTelefone})`)
        } else if (sendResult.skipped) {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: sendResult.error || 'Telefone inválido',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          skipped++
        } else {
          const newStatus = item.attempts >= 2 ? 'FAILED' : 'PENDING'

          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: newStatus,
              error_message: sendResult.error || 'Erro desconhecido',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          if (newStatus === 'FAILED') {
            failed++
            console.log(`[ProcessCashbackQueue] ❌ WhatsApp falhou após 3 tentativas: ${sendResult.error}`)
          } else {
            console.log(`[ProcessCashbackQueue] ⚠️ Tentativa ${item.attempts + 1} falhou: ${sendResult.error}`)
          }
        }

        processed++
      } catch (itemError: any) {
        console.error(`[ProcessCashbackQueue] ❌ Erro ao processar item ${item.id}:`, itemError)

        if (item.attempts < 2) {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'PENDING',
              error_message: itemError.message || String(itemError),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        } else {
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'FAILED',
              error_message: itemError.message || String(itemError),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
          failed++
        }
        processed++
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
  } catch (error: any) {
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
