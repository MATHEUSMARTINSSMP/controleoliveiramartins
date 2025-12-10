# 🔄 Sistema de Webhook de Pagamento - Documentação Completa

## 📋 Visão Geral

O sistema de webhook é **genérico e multi-gateway**, permitindo receber eventos de qualquer gateway de pagamento (Stripe, Mercado Pago, PagSeguro, Asaas, **CAKTO**, etc.) e processá-los de forma unificada.

## 🔗 Endpoint do Webhook

```
https://eleveaone.com.br/.netlify/functions/payment-webhook
```

### Parâmetros Opcionais

- **Query Parameter**: `?gateway=STRIPE` (ou MERCADO_PAGO, PAGSEGURO, ASAAS, **CAKTO**, CUSTOM)
- **Header**: `x-gateway: STRIPE`

Se não especificado, o sistema usa `CUSTOM` como padrão.

## 🔄 Fluxo de Processamento

### 1. Recebimento do Evento

```
Gateway de Pagamento
    ↓
[Webhook] → https://eleveaone.com.br/.netlify/functions/payment-webhook
    ↓
Netlify Function (payment-webhook.js)
```

### 2. Detecção do Gateway

O sistema detecta o gateway através de:
- Query parameter: `?gateway=STRIPE`
- Header: `x-gateway: STRIPE`
- Padrão: `CUSTOM` (se não especificado)

### 3. Registro do Evento

Todo evento é **primeiro registrado** na tabela `billing_events`:

```sql
INSERT INTO billing_events (
    payment_gateway,
    external_event_id,
    event_type,
    event_data,
    processed: false
)
```

Isso garante:
- ✅ Auditoria completa
- ✅ Reprocessamento se necessário
- ✅ Debugging facilitado

### 4. Processamento do Evento

O evento é roteado para o handler específico do gateway:

```javascript
switch (gateway) {
  case 'STRIPE':
    handleStripeEvent(supabase, eventData);
    break;
  case 'MERCADO_PAGO':
    handleMercadoPagoEvent(supabase, eventData);
    break;
  // ... outros gateways
  default:
    handleGenericEvent(supabase, gateway, eventData);
}
```

### 5. Atualização da Subscription

O handler chama a função SQL `update_subscription_from_gateway`:

```sql
SELECT * FROM update_subscription_from_gateway(
    p_payment_gateway := 'STRIPE',
    p_external_subscription_id := 'sub_xxx',
    p_gateway_data := {...}
);
```

Esta função:
- ✅ Busca a subscription pelo `external_subscription_id`
- ✅ Extrai dados do evento (status, datas, valores)
- ✅ Normaliza status entre gateways
- ✅ Atualiza `admin_subscriptions`

### 6. Registro de Pagamento

Se o evento for de pagamento (`payment.*` ou `invoice.*`), registra em `payment_history`:

```sql
SELECT * FROM record_payment(
    p_subscription_id := uuid,
    p_payment_gateway := 'STRIPE',
    p_external_payment_id := 'pi_xxx',
    p_amount := 10000, -- em centavos
    p_status := 'SUCCEEDED',
    ...
);
```

### 7. Marcação como Processado

Após processar com sucesso:

```sql
UPDATE billing_events
SET processed = true
WHERE payment_gateway = 'STRIPE'
  AND external_event_id = 'evt_xxx';
```

## 📊 Estrutura de Dados

### Tabela: `billing_events`

Armazena **todos os eventos** recebidos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID interno |
| `payment_gateway` | TEXT | Gateway (STRIPE, MERCADO_PAGO, etc) |
| `external_event_id` | TEXT | ID do evento no gateway |
| `event_type` | TEXT | Tipo do evento (payment.succeeded, etc) |
| `subscription_id` | UUID | ID da subscription (se encontrado) |
| `admin_id` | UUID | ID do admin (se encontrado) |
| `processed` | BOOLEAN | Se já foi processado |
| `event_data` | JSONB | Dados completos do evento |
| `created_at` | TIMESTAMPTZ | Data de recebimento |

### Tabela: `admin_subscriptions`

Armazena as assinaturas dos admins:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `admin_id` | UUID | ID do admin (profile.id) |
| `payment_gateway` | TEXT | Gateway usado |
| `external_subscription_id` | TEXT | ID da subscription no gateway |
| `status` | TEXT | ACTIVE, SUSPENDED, CANCELLED, TRIAL |
| `payment_status` | TEXT | PAID, UNPAID, PAST_DUE, TRIAL |
| `current_period_end` | TIMESTAMPTZ | Data de término do período atual |
| `last_payment_date` | TIMESTAMPTZ | Data do último pagamento |

### Tabela: `payment_history`

Histórico completo de pagamentos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `subscription_id` | UUID | ID da subscription |
| `admin_id` | UUID | ID do admin |
| `payment_gateway` | TEXT | Gateway usado |
| `external_payment_id` | TEXT | ID do pagamento no gateway |
| `amount` | INTEGER | Valor em centavos |
| `status` | TEXT | SUCCEEDED, FAILED, REFUNDED, etc |
| `payment_date` | TIMESTAMPTZ | Data do pagamento |

## 🔐 Segurança

### Autenticação do Webhook

Cada gateway tem sua própria forma de autenticação:

1. **Stripe**: Verifica assinatura com `stripe-signature` header
2. **Mercado Pago**: Verifica com `x-signature` header
3. **Asaas**: Verifica com `x-asaas-signature` header

**⚠️ IMPORTANTE**: Implementar validação de assinatura para cada gateway específico.

### Headers Suportados

```javascript
'stripe-signature'      // Stripe
'x-signature'          // Mercado Pago
'x-asaas-signature'    // Asaas
'x-gateway'            // Gateway genérico
```

## 🎯 Eventos Suportados

### Eventos Genéricos (todos os gateways)

O sistema tenta extrair automaticamente:

- `subscription.*` → Atualiza subscription
- `payment.*` → Registra pagamento
- `invoice.*` → Registra pagamento
- `customer.*` → Atualiza dados do cliente

### Mapeamento de Status

```javascript
SUCCESS/PAID/COMPLETED → SUCCEEDED
FAIL/ERROR → FAILED
REFUND → REFUNDED
CANCEL → CANCELED
Outros → PENDING
```

## 📝 Exemplo de Uso

### Configurar Webhook no Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Adicione endpoint: `https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=STRIPE`
3. Selecione eventos:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### Configurar Webhook no Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Adicione webhook: `https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=MERCADO_PAGO`
3. Configure eventos de assinatura e pagamento

### Configurar Webhook no CAKTO

1. Acesse a documentação: [CAKTO Webhooks](https://burly-level-c93.notion.site/Webhooks-pt-br-13c5b1d7878780d792f0fcda3411955c)
2. Configure o webhook no painel do CAKTO apontando para:
   ```
   https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
   ```
3. Configure os eventos necessários conforme a documentação do CAKTO
4. Configure o Webhook Secret no painel de configurações do sistema (`/dev/erp-config` → aba "Gateways de Pagamento")

## 🔍 Debugging

### Ver Eventos Recebidos

```sql
SELECT 
    id,
    payment_gateway,
    event_type,
    external_event_id,
    processed,
    created_at,
    event_data
FROM sistemaretiradas.billing_events
ORDER BY created_at DESC
LIMIT 50;
```

### Ver Eventos Não Processados

```sql
SELECT * FROM sistemaretiradas.billing_events
WHERE processed = false
ORDER BY created_at DESC;
```

### Reprocessar Evento

```sql
-- Marcar como não processado
UPDATE sistemaretiradas.billing_events
SET processed = false
WHERE id = 'uuid-do-evento';

-- O sistema pode ter um job que reprocessa eventos pendentes
```

## 🚀 Próximos Passos

1. **Implementar validação de assinatura** para cada gateway
2. **Criar job de reprocessamento** de eventos falhos
3. **Adicionar notificações** quando pagamento falhar
4. **Dashboard de eventos** para visualizar webhooks recebidos
5. **Testes automatizados** para cada gateway

## 📚 Referências

- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Mercado Pago Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Asaas Webhooks](https://docs.asaas.com/docs/webhooks)

