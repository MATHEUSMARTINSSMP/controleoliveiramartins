# 🚀 Exemplo de Implementação: PIX Webhook

## 📋 Visão Geral

Este documento mostra como implementar validação de PIX usando webhooks de APIs de pagamento, **sem lidar com dados bancários sensíveis**.

---

## 🏗️ Arquitetura

```
Cliente → API de Pagamento (Pagou.ai/MisticPay/etc)
    ↓
[PIX Recebido]
    ↓
API envia POST para nosso webhook
    ↓
/netlify/functions/pix-webhook
    ↓
Valida assinatura
    ↓
Processa evento
    ↓
Atualiza venda no banco
```

---

## 📝 1. Criar Netlify Function

**Arquivo**: `netlify/functions/pix-webhook.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // CORS preflight
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
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Configuração do servidor incompleta' }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { db: { schema: 'sistemaretiradas' } }
    );

    // Parse body
    const eventData = JSON.parse(event.body || '{}');

    // Validar assinatura do webhook (HMAC)
    const webhookSecret = process.env.PIX_WEBHOOK_SECRET; // Configurar na API
    if (!validateWebhookSignature(eventData, webhookSecret, event.headers)) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Assinatura inválida' }),
      };
    }

    // Processar evento
    const result = await processPixEvent(supabase, eventData);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result }),
    };
  } catch (error) {
    console.error('[PIX Webhook] Erro:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Validar assinatura HMAC do webhook
 */
function validateWebhookSignature(eventData, secret, headers) {
  if (!secret) {
    console.warn('[PIX Webhook] Webhook secret não configurado');
    return true; // Em desenvolvimento, pode ser permissivo
  }

  // Exemplo: Pagou.ai envia assinatura no header
  const signature = headers['x-pagou-signature'] || headers['x-signature'];
  
  if (!signature) {
    return false;
  }

  // Calcular HMAC
  const payload = JSON.stringify(eventData);
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Comparar assinaturas (usar comparação segura)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hmac)
  );
}

/**
 * Processar evento de PIX recebido
 */
async function processPixEvent(supabase, eventData) {
  const { event, data } = eventData;

  console.log('[PIX Webhook] Evento recebido:', event);

  // Evento: PIX recebido
  if (event === 'pix.received' || event === 'pix.paid') {
    const {
      transaction_id,
      value,
      pix_key, // Chave PIX (email, CPF, etc)
      payer_name,
      received_at,
      end_to_end_id,
      // Outros campos dependendo da API
    } = data;

    console.log('[PIX Webhook] PIX recebido:', {
      value,
      pix_key,
      transaction_id,
    });

    // 1. Buscar vendas pendentes que correspondem a este PIX
    // Critério: chave PIX + valor aproximado + status pendente
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, store_id, colaboradora_id, valor_total, forma_pagamento, formas_pagamento_json')
      .eq('status', 'pendente') // ou status específico para PIX pendente
      .gte('valor_total', value - 0.01) // Tolerância de 1 centavo
      .lte('valor_total', value + 0.01)
      .order('created_at', { ascending: false })
      .limit(10); // Limitar para performance

    if (salesError) {
      console.error('[PIX Webhook] Erro ao buscar vendas:', salesError);
      return { processed: false, error: salesError.message };
    }

    if (!sales || sales.length === 0) {
      console.log('[PIX Webhook] Nenhuma venda encontrada para este PIX');
      // Opcional: salvar PIX não identificado para reconciliação manual
      await saveUnidentifiedPix(supabase, data);
      return { processed: false, reason: 'Nenhuma venda correspondente' };
    }

    // 2. Encontrar venda mais provável (ex: última venda pendente)
    // Em produção, pode fazer matching mais sofisticado
    const sale = sales[0];

    // 3. Atualizar venda como paga
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'pago', // ou status específico
        payment_confirmed_at: received_at || new Date().toISOString(),
        payment_metadata: {
          pix_transaction_id: transaction_id,
          pix_end_to_end_id: end_to_end_id,
          pix_received_at: received_at,
          pix_key: pix_key,
          payer_name: payer_name,
        },
      })
      .eq('id', sale.id);

    if (updateError) {
      console.error('[PIX Webhook] Erro ao atualizar venda:', updateError);
      return { processed: false, error: updateError.message };
    }

    console.log('[PIX Webhook] Venda atualizada:', sale.id);

    // 4. (Opcional) Notificar vendedor/cliente
    // await notifyPaymentConfirmation(supabase, sale);

    return {
      processed: true,
      sale_id: sale.id,
      transaction_id,
    };
  }

  // Outros tipos de eventos podem ser processados aqui
  return { processed: false, reason: 'Evento não reconhecido' };
}

/**
 * Salvar PIX não identificado para reconciliação manual
 */
async function saveUnidentifiedPix(supabase, pixData) {
  // Criar tabela pix_unidentified se não existir
  // ou salvar em tabela de eventos/logs
  const { error } = await supabase
    .from('pix_events') // ou tabela apropriada
    .insert({
      event_type: 'unidentified_pix',
      event_data: pixData,
      processed: false,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[PIX Webhook] Erro ao salvar PIX não identificado:', error);
  }
}
```

---

## 📊 2. Criar Tabela para Eventos PIX (Opcional)

**Migration**: `supabase/migrations/XXXXXX_create_pix_events.sql`

```sql
-- Tabela para armazenar eventos PIX recebidos
CREATE TABLE IF NOT EXISTS sistemaretiradas.pix_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255),
  value DECIMAL(10, 2),
  pix_key VARCHAR(255),
  payer_name VARCHAR(255),
  received_at TIMESTAMPTZ,
  event_data JSONB,
  sale_id UUID REFERENCES sistemaretiradas.sales(id),
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pix_events_transaction_id 
  ON sistemaretiradas.pix_events(transaction_id);

CREATE INDEX IF NOT EXISTS idx_pix_events_processed 
  ON sistemaretiradas.pix_events(processed) 
  WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_pix_events_received_at 
  ON sistemaretiradas.pix_events(received_at DESC);
```

---

## 🔧 3. Configuração

### Variáveis de Ambiente (Netlify)

```bash
PIX_WEBHOOK_SECRET=seu_secret_aqui  # Secret fornecido pela API
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### URL do Webhook

Configure na API de pagamento:
```
https://eleveaone.com.br/.netlify/functions/pix-webhook
```

---

## 🧪 4. Testes

### Teste Manual (usando curl)

```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/pix-webhook \
  -H "Content-Type: application/json" \
  -H "x-pagou-signature: signature_here" \
  -d '{
    "event": "pix.received",
    "data": {
      "transaction_id": "test123",
      "value": 100.00,
      "pix_key": "email@exemplo.com",
      "payer_name": "Teste",
      "received_at": "2025-12-27T10:30:00Z"
    }
  }'
```

---

## 📈 5. Melhorias Futuras

1. **Matching Inteligente**:
   - Usar algoritmo de matching mais sofisticado
   - Considerar horário aproximado
   - Considerar múltiplas vendas

2. **Notificações**:
   - Notificar vendedor quando PIX confirmado
   - Notificar cliente (email/SMS)

3. **Dashboard**:
   - Mostrar PIXs pendentes
   - Reconciliação manual para PIXs não identificados

4. **Múltiplas APIs**:
   - Suporte para várias APIs de pagamento
   - Abstração para facilitar troca de API

---

## ✅ Vantagens desta Abordagem

1. ✅ **Segurança**: Não lida com dados bancários
2. ✅ **Simplicidade**: Implementação muito mais fácil
3. ✅ **Manutenção**: Menos complexo que Open Banking
4. ✅ **Escalabilidade**: Funciona com qualquer volume
5. ✅ **Reuso**: Pode reutilizar estrutura de `payment-webhook.js`

