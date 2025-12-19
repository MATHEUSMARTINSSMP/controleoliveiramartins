# 🔄 Atualização do Webhook Cakto - Baseado na Documentação Oficial

## 📚 Mudanças Aplicadas

### 1. ✅ Estrutura do Webhook Corrigida

**Estrutura Oficial do Cakto:**
```json
{
  "secret": "123",
  "event": "purchase_approved",
  "data": {
    "id": "...",
    "customer": { "email": "...", "name": "..." },
    "product": { "name": "...", "id": "..." },
    "amount": 499.00,
    ...
  }
}
```

**Mudanças:**
- ✅ Campo `event` (não `type`) para identificar o evento
- ✅ Campo `secret` no nível raiz (não dentro de `data`)
- ✅ Dados principais em `data` (não diretamente no root)
- ✅ `data.id` ou `data.refId` para purchase ID

### 2. ✅ Eventos Suportados

**Eventos Implementados:**
- ✅ `purchase_approved` - Compra aprovada (cria usuário)
- ✅ `subscription_renewed` - Renovação de assinatura (atualiza subscription)
- ✅ `subscription_canceled` - Cancelamento de assinatura (cancela subscription)

**Eventos Futuros (pode adicionar depois):**
- ⏳ `purchase_refused` - Compra recusada
- ⏳ `refund` - Reembolso
- ⏳ `chargeback` - Chargeback

### 3. ✅ Extração de Dados Corrigida

**Antes (incorreto):**
```javascript
const email = eventData.customer?.email || eventData.email || ...
const purchaseId = eventData.purchase_id || eventData.id || ...
```

**Depois (correto):**
```javascript
const email = data.customer?.email;  // data vem de rawEventData.data
const purchaseId = data.id || data.refId;
const planName = data.product?.name || data.offer?.name;
const amount = data.amount || data.baseAmount;
```

### 4. ✅ Validação de Secret

**Corrigido:**
- Secret agora é extraído de `rawEventData.secret` (nível raiz)
- Não mais de `eventData.secret` ou headers

### 5. ✅ Função de Cancelamento Adicionada

Nova função `handleCaktoSubscriptionCanceled`:
- Busca usuário por email
- Localiza subscription ativa
- Atualiza status para `CANCELED`

## 📋 Campos por Método de Pagamento

Conforme documentação, alguns campos só existem para métodos específicos:

### Pix
- `data.pix.qrCode`
- `data.pix.expirationDate`

### Cartão
- `data.card.holderName`
- `data.card.lastDigits`
- `data.card.brand`

### Boleto
- `data.barcode`
- `data.boletoUrl`
- `data.expirationDate`

## ✅ Status de Implementação

| Funcionalidade | Status |
|----------------|--------|
| Estrutura correta do webhook | ✅ |
| Extração de dados correta | ✅ |
| Validação de secret | ✅ |
| Criação de usuário | ✅ |
| Criação de subscription | ✅ |
| Cancelamento de subscription | ✅ |
| Renovação de subscription | ✅ |
| Suporte a GET (health check) | ✅ |
| Logs detalhados | ✅ |

## 🧪 Testar

### 1. Health Check (GET)
```bash
curl https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
```

### 2. Webhook Real (POST)
```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "test_secret",
    "event": "purchase_approved",
    "data": {
      "id": "test_123",
      "refId": "REF123",
      "customer": {
        "email": "teste@exemplo.com",
        "name": "Cliente Teste"
      },
      "product": {
        "name": "Plano Business",
        "id": "prod_123"
      },
      "amount": 499.00,
      "status": "paid"
    }
  }'
```

## 📝 Próximos Passos

1. ✅ Deploy das correções
2. ⏳ Testar com webhook real do Cakto
3. ⏳ Verificar logs após receber evento real
4. ⏳ (Opcional) Adicionar handlers para outros eventos (refund, chargeback, etc.)

## 🎯 Referências

- [Documentação Oficial Cakto Webhooks](https://burly-level-c93.notion.site/Webhooks-pt-br-13c5b1d7878780d792f0fcda3411955c)
- Estrutura baseada na documentação fornecida pelo usuário

