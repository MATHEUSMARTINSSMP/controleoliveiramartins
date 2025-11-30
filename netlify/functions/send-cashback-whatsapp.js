/**
 * Netlify Function: Enviar WhatsApp de Cashback Gerado
 * 
 * Esta função é chamada automaticamente quando um cashback é gerado
 * Envia mensagem WhatsApp para o cliente informando sobre o cashback
 * 
 * Endpoint: /.netlify/functions/send-cashback-whatsapp
 * Método: POST
 * 
 * Body esperado:
 * {
 *   "transaction_id": "uuid",
 *   "cliente_id": "uuid",
 *   "store_id": "uuid"
 * }
 */

const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { transaction_id, cliente_id, store_id } = body;

    if (!transaction_id || !cliente_id || !store_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'transaction_id, cliente_id e store_id são obrigatórios',
        }),
      };
    }

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

    console.log('[SendCashbackWhatsApp] 📱 Buscando dados para envio de WhatsApp...');
    console.log('[SendCashbackWhatsApp] Transaction ID:', transaction_id);
    console.log('[SendCashbackWhatsApp] Cliente ID:', cliente_id);
    console.log('[SendCashbackWhatsApp] Store ID:', store_id);

    // 1. Buscar dados da transação de cashback
    const { data: transaction, error: transactionError } = await supabase
      .from('cashback_transactions')
      .select('amount, data_expiracao')
      .eq('id', transaction_id)
      .eq('transaction_type', 'EARNED')
      .single();

    if (transactionError || !transaction) {
      console.error('[SendCashbackWhatsApp] ❌ Erro ao buscar transação:', transactionError);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Transação de cashback não encontrada',
        }),
      };
    }

    // 2. Buscar dados do cliente (nome e telefone)
    const { data: cliente, error: clienteError } = await supabase
      .from('tiny_contacts')
      .select('nome, telefone')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      console.error('[SendCashbackWhatsApp] ❌ Erro ao buscar cliente:', clienteError);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Cliente não encontrado',
        }),
      };
    }

    // Verificar se cliente tem telefone
    if (!cliente.telefone || cliente.telefone.trim() === '') {
      console.warn('[SendCashbackWhatsApp] ⚠️ Cliente sem telefone, não é possível enviar WhatsApp');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Cliente não possui telefone cadastrado',
          skipped: true,
        }),
      };
    }

    // 3. Buscar dados da loja (nome)
    const { data: loja, error: lojaError } = await supabase
      .from('stores')
      .select('name')
      .eq('id', store_id)
      .single();

    if (lojaError || !loja) {
      console.error('[SendCashbackWhatsApp] ❌ Erro ao buscar loja:', lojaError);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Loja não encontrada',
        }),
      };
    }

    // 4. Buscar configurações de cashback
    const { data: settings, error: settingsError } = await supabase
      .from('cashback_settings')
      .select('percentual_uso_maximo')
      .or(`store_id.is.null,store_id.eq.${store_id}`)
      .order('store_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const percentualUsoMaximo = settings?.percentual_uso_maximo || 30.0;

    // 5. Buscar saldo atual do cliente
    const { data: saldo, error: saldoError } = await supabase
      .from('cashback_balance')
      .select('balance')
      .eq('cliente_id', cliente_id)
      .single();

    const saldoAtual = saldo?.balance || 0;

    // 6. Formatar mensagem
    const primeiroNome = cliente.nome.split(' ')[0];
    const cashbackFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(transaction.amount));

    const saldoFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(saldoAtual));

    const dataExpiracaoFormatada = new Date(transaction.data_expiracao).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const percentualFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(percentualUsoMaximo) / 100);

    const message = `🎁 *Cashback Gerado!*\n\n` +
      `${primeiroNome},\n\n` +
      `Obrigado pela sua compra na ${loja.name}, nós somos muito gratos por ter você como nossa cliente.\n\n` +
      `Você gerou ${cashbackFormatado} de cashback para você utilizar em nossa loja.\n\n` +
      `Esse cashback é válido até o dia ${dataExpiracaoFormatada} e você poderá cobrir até ${percentualFormatado} do valor da sua próxima compra.\n\n` +
      `Seu saldo atual é ${saldoFormatado}.\n\n` +
      `Com carinho,\n${loja.name}\n\n` +
      `Sistema EleveaOne 📊`;

    // 7. Normalizar telefone
    const normalizePhone = (phoneNumber) => {
      let cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
      }
      return cleaned;
    };

    const telefoneNormalizado = normalizePhone(cliente.telefone);

    console.log('[SendCashbackWhatsApp] 📱 Enviando WhatsApp para:', telefoneNormalizado);
    console.log('[SendCashbackWhatsApp] Mensagem:', message.substring(0, 100) + '...');

    // 8. Enviar WhatsApp via webhook n8n
    const webhookUrl = 'https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send';
    const webhookAuth = '#mmP220411';
    const siteSlug = 'elevea';
    const customerId = 'mathmartins@gmail.com';

    const messageEscaped = JSON.stringify(message);
    const messageSafe = messageEscaped.slice(1, -1);

    const payload = {
      siteSlug: siteSlug,
      customerId: customerId,
      phoneNumber: telefoneNormalizado,
      message: messageSafe,
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-app-key': webhookAuth,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText, raw: responseText };
    }

    if (!response.ok) {
      console.error('[SendCashbackWhatsApp] ❌ Erro ao enviar WhatsApp:', responseData);
      throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`);
    }

    console.log('[SendCashbackWhatsApp] ✅ WhatsApp enviado com sucesso!');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'WhatsApp enviado com sucesso',
        data: {
          telefone: telefoneNormalizado,
          cliente_nome: cliente.nome,
          cashback_amount: transaction.amount,
        },
      }),
    };
  } catch (error) {
    console.error('[SendCashbackWhatsApp] ❌ Erro:', error);
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

