// Supabase Edge Function: Processar Fila de WhatsApp de Cashback
// Esta função processa a fila de WhatsApp de cashback automaticamente
// Usa a mesma lógica de envio de WhatsApp que já existe no sistema

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para normalizar telefone para WhatsApp (DDI + DDD + número)
// Formato esperado: 55DDDXXXXXXXXX (ex: 5596981032928)
function normalizePhone(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  // 1. Remove todos os caracteres não numéricos
  let cleaned = phoneNumber.replace(/\D/g, '')
  
  // 2. Remove zero inicial se houver (ex: 096 -> 96)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }
  
  // 3. Se já tem DDI 55 e está no tamanho correto (12 ou 13 dígitos), manter
  // Formato correto: 55 + DDD (2) + número (8 ou 9) = 12 ou 13 dígitos
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return cleaned // Já está no formato correto
  }
  
  // 4. Se tem DDI 55 mas está muito longo (possível duplicação), remover o primeiro 55
  if (cleaned.startsWith('55') && cleaned.length > 13) {
    cleaned = cleaned.substring(2)
  }
  
  // 5. Validação de tamanho após limpeza (deve ter 10 ou 11 dígitos = DDD + número)
  if (cleaned.length < 10 || cleaned.length > 11) {
    console.warn(`[normalizePhone] ⚠️ Telefone com tamanho inválido após limpeza: ${cleaned.length} dígitos (${phoneNumber})`)
    // Se tiver menos de 10 dígitos, pode estar incompleto
    if (cleaned.length < 10) {
      return cleaned
    }
  }
  
  // 6. Adiciona DDI 55 (Brasil) se não tiver
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }
  
  // 7. Verificar se o número após DDD começa com "99" (possível 9 duplicado)
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    const ddi = cleaned.substring(0, 2) // 55
    const ddd = cleaned.substring(2, 4) // DDD (pode ser 96, 99, etc)
    const numero = cleaned.substring(4) // Número após DDI+DDD (9 dígitos)
    
    // Se o número começa com "99", pode haver um 9 duplicado
    if (numero.startsWith('99') && numero.length === 9) {
      // Remove o primeiro 9 do número: 55 + DDD + 99XXXXXXX -> 55 + DDD + 9XXXXXXX
      cleaned = ddi + ddd + numero.substring(1) // Remove primeiro dígito do número (um dos 9s)
      console.log(`[normalizePhone] 🔧 Removido 9 duplicado (número começa com 99): ${phoneNumber} -> ${cleaned}`)
    }
  }
  
  // 8. VERIFICAÇÃO EXTRA: Verificar de trás para frente se o 9º dígito do final é 9 extra
  // Celulares brasileiros: 55 + DDD (2) + 9 (celular) + 8 dígitos = 13 dígitos
  // Se o 9º e 10º dígitos a partir do final forem ambos 9, há duplicação
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    const nonoDoFinal = cleaned[cleaned.length - 9] // Índice: length - 9 (0-based)
    const decimoDoFinal = cleaned[cleaned.length - 10]
    
    // Se ambos são 9, há duplicação - remover o 9 extra (o 9º do final)
    if (nonoDoFinal === '9' && decimoDoFinal === '9') {
      // Remove o 9 extra: mantém tudo exceto o 9º dígito a partir do final
      const antes = cleaned.substring(0, cleaned.length - 9) // Tudo antes do 9 extra
      const depois = cleaned.substring(cleaned.length - 8) // Tudo depois do 9 extra
      cleaned = antes + depois
      console.log(`[normalizePhone] 🔧 Removido 9 extra (verificação de trás para frente): ${phoneNumber} -> ${cleaned}`)
    }
  }
  
  // 9. Validação final: deve ter 12 dígitos (55 + DDD + 8 dígitos) ou 13 (55 + DDD + 9 dígitos)
  // Formato: 55 + DDD (2 dígitos) + número (8 dígitos para WhatsApp)
  if (cleaned.length === 12 || cleaned.length === 13) {
    return cleaned
  }
  
  console.warn(`[normalizePhone] ⚠️ Telefone normalizado com formato inesperado: ${cleaned} (${cleaned.length} dígitos, original: ${phoneNumber})`)
  return cleaned
}

// Função para formatar mensagem de cashback (mesma lógica do formatCashbackMessage)
function formatCashbackMessage(params: {
  clienteNome: string
  storeName: string
  cashbackAmount: number
  dataExpiracao: string
  percentualUsoMaximo: number
  saldoAtual: number
}): string {
  const { clienteNome, storeName, cashbackAmount, dataExpiracao, percentualUsoMaximo, saldoAtual } = params
  
  // Extrair apenas o primeiro nome
  const primeiroNome = clienteNome.split(' ')[0]
  
  // Formatar valores monetários
  const cashbackFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cashbackAmount)
  
  const saldoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(saldoAtual)
  
  // Formatar data de expiração
  const dataExpiracaoFormatada = new Date(dataExpiracao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  
  // Formatar percentual de uso máximo
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

// Função para enviar WhatsApp via webhook n8n (mesma lógica do send-whatsapp-message.js)
async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    // Validar telefone antes de normalizar
    if (!phone || phone.trim() === '') {
      return { success: false, error: 'Telefone vazio', skipped: true }
    }

    // Normalizar telefone
    const normalizedPhone = normalizePhone(phone)
    
    // Validar telefone normalizado (deve ter pelo menos 12 dígitos: 55 + DDD + número)
    if (!normalizedPhone || normalizedPhone.length < 12) {
      return { success: false, error: `Telefone normalizado inválido: ${normalizedPhone}`, skipped: true }
    }
    
    // Credenciais do webhook via variáveis de ambiente
    const webhookUrl = Deno.env.get('WHATSAPP_WEBHOOK_URL') || 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send'
    const webhookAuth = Deno.env.get('N8N_WEBHOOK_AUTH') || ''
    const siteSlug = Deno.env.get('WHATSAPP_SITE_SLUG') || 'elevea'
    const customerId = Deno.env.get('N8N_CUSTOMER_ID') || ''

    // Escapar mensagem como string JSON (mesma lógica do send-whatsapp-message.js)
    const messageEscaped = JSON.stringify(message)
    const messageSafe = messageEscaped.slice(1, -1)

    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phone_number: String(normalizedPhone), // snake_case + String() para garantir que não seja tratado como número
      message: messageSafe,
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-app-key': webhookAuth,
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

    if (!response.ok) {
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) }
  }
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

        // 1. Buscar dados da transação de cashback
        const { data: transaction, error: transactionError } = await supabase
          .from('cashback_transactions')
          .select('amount, data_expiracao')
          .eq('id', item.transaction_id)
          .eq('transaction_type', 'EARNED')
          .single()

        if (transactionError || !transaction) {
          throw new Error('Transação de cashback não encontrada')
        }

        // 2. Buscar dados do cliente (nome e telefone)
        // Primeiro tentar usar os dados que já estão na fila (preenchidos pelo trigger)
        let clienteNome = item.cliente_nome
        let clienteTelefone = item.cliente_telefone

        // Se não tiver na fila, buscar do banco (tiny_contacts primeiro, depois crm_contacts)
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
            // Tentar crm_contacts
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

        // Verificar se cliente tem telefone válido
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

        // Validar telefone antes de normalizar (deve ter pelo menos 10 dígitos após limpar)
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
          console.log(`[ProcessCashbackQueue] ⏭️ WhatsApp pulado: telefone inválido (${clienteTelefone}) - transação ${item.transaction_id}`)
          processed++
          continue
        }

        // 3. Buscar dados da loja (nome)
        const { data: loja, error: lojaError } = await supabase
          .from('stores')
          .select('name')
          .eq('id', item.store_id)
          .single()

        if (lojaError || !loja) {
          throw new Error('Loja não encontrada')
        }

        // 4. Buscar configurações de cashback
        const { data: settings } = await supabase
          .from('cashback_settings')
          .select('percentual_uso_maximo')
          .or(`store_id.is.null,store_id.eq.${item.store_id}`)
          .order('store_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        const percentualUsoMaximo = settings?.percentual_uso_maximo || 30.0

        // 5. Buscar saldo atual do cliente (balance_disponivel + balance_pendente)
        // ✅ CORREÇÃO: Buscar saldo mais recente e garantir que a transação atual está incluída
        const { data: saldo } = await supabase
          .from('cashback_balance')
          .select('balance, balance_disponivel, balance_pendente')
          .eq('cliente_id', item.cliente_id)
          .single()

        // ✅ CORREÇÃO: Calcular saldo total corretamente
        // Se o saldo ainda não foi atualizado pelo trigger, calcular manualmente
        let saldoAtual = 0
        if (saldo) {
          // Usar balance (que já é disponivel + pendente) ou somar os dois campos
          saldoAtual = saldo.balance || ((saldo.balance_disponivel || 0) + (saldo.balance_pendente || 0))
        }
        
        // ✅ FALLBACK: Se saldo é zero mas temos a transação, o saldo mínimo é o valor da transação
        // Isso acontece quando o trigger do banco ainda não atualizou o cashback_balance
        if (saldoAtual === 0 && transaction.amount > 0) {
          console.log(`[ProcessCashbackQueue] ⚠️ Saldo zerado, usando valor da transação como fallback: ${transaction.amount}`)
          saldoAtual = Number(transaction.amount)
        } else if (saldoAtual > 0 && saldoAtual < Number(transaction.amount)) {
          // Se saldo existe mas é menor que a transação, significa que não foi atualizado ainda
          console.log(`[ProcessCashbackQueue] ⚠️ Saldo (${saldoAtual}) menor que transação (${transaction.amount}), ajustando...`)
          saldoAtual = Math.max(saldoAtual, Number(transaction.amount))
        }
        
        console.log(`[ProcessCashbackQueue] 💰 Saldo calculado: ${saldoAtual} (balance: ${saldo?.balance || 0}, disponivel: ${saldo?.balance_disponivel || 0}, pendente: ${saldo?.balance_pendente || 0})`)

        // 6. Formatar mensagem usando a mesma função do sistema
        const message = formatCashbackMessage({
          clienteNome: clienteNome,
          storeName: loja.name,
          cashbackAmount: Number(transaction.amount),
          dataExpiracao: transaction.data_expiracao,
          percentualUsoMaximo: Number(percentualUsoMaximo),
          saldoAtual: Number(saldoAtual),
        })

        // 7. Enviar WhatsApp usando a mesma lógica do send-whatsapp-message.js
        const sendResult = await sendWhatsAppMessage(clienteTelefone, message)

        if (sendResult.success) {
          // Sucesso
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SENT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          sent++
          console.log(`[ProcessCashbackQueue] ✅ WhatsApp enviado para transação ${item.transaction_id} (cliente: ${clienteNome}, telefone: ${clienteTelefone})`)
        } else if (sendResult.skipped) {
          // Cliente sem telefone válido - marcar como SKIPPED
          await supabase
            .from('cashback_whatsapp_queue')
            .update({
              status: 'SKIPPED',
              error_message: sendResult.error || 'Telefone inválido',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          skipped++
          console.log(`[ProcessCashbackQueue] ⏭️ WhatsApp pulado: ${sendResult.error} (transação ${item.transaction_id}, cliente: ${clienteNome})`)
        } else {
          // Falha
          const newStatus = item.attempts >= 2 ? 'FAILED' : 'PENDING' // Tentar até 3 vezes

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
            console.log(`[ProcessCashbackQueue] ❌ WhatsApp falhou após 3 tentativas para transação ${item.transaction_id}: ${sendResult.error}`)
          } else {
            console.log(`[ProcessCashbackQueue] ⚠️ Tentativa ${item.attempts + 1} falhou, tentando novamente: ${sendResult.error}`)
          }
        }

        processed++
      } catch (itemError: any) {
        console.error(`[ProcessCashbackQueue] ❌ Erro ao processar item ${item.id}:`, itemError)

        // Marcar como PENDING novamente se não excedeu tentativas
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

