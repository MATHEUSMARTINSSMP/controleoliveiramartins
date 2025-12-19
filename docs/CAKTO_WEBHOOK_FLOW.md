# 🔄 Como Funciona o Webhook do Cakto

## 📍 Endpoint do Webhook

```
https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
```

## 🔄 Fluxo Completo

### 1️⃣ Cliente Faz Compra no Cakto

```
Cliente → Cakto Checkout → Pagamento Aprovado
```

### 2️⃣ Cakto Envia Webhook

Quando o pagamento é aprovado, o Cakto envia uma requisição POST para nosso webhook:

```
POST https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
Headers:
  Content-Type: application/json
  x-cakto-signature: [secret] (opcional)

Body (JSON):
{
  "type": "purchase.approved",
  "purchase_id": "12345",
  "customer": {
    "email": "cliente@email.com",
    "name": "Nome do Cliente"
  },
  "product": {
    "name": "Plano Business",
    "id": "prod_123"
  },
  "amount": 499.00,
  "status": "approved"
}
```

### 3️⃣ Webhook Recebe e Valida

```javascript
// 1. Detecta gateway = CAKTO
const gateway = event.queryStringParameters?.gateway; // "CAKTO"

// 2. Valida assinatura (se configurada)
validateCaktoSignature(supabase, event);

// 3. Processa evento
handleCaktoEvent(supabase, eventData);
```

### 4️⃣ Processa Evento de Compra Aprovada

```javascript
// Detecta tipo de evento
if (eventType === 'purchase.approved' || 
    eventType === 'purchase_approved' || 
    caktoEvent.status === 'approved') {
  
  // Cria usuário automaticamente
  handleCaktoPurchaseApproved(supabase, caktoEvent);
}
```

### 5️⃣ Cria Usuário ADMIN

```javascript
// Extrai dados do webhook
const customerEmail = eventData.customer?.email;
const customerName = eventData.customer?.name;
const purchaseId = eventData.purchase_id;
const planName = eventData.product?.name;

// Se faltar dados, tenta buscar da API (opcional)
if (!customerEmail && purchaseId) {
  const purchaseDetails = await getCaktoPurchase(purchaseId);
  // Enriquece dados
}

// Gera senha aleatória
const password = generateRandomPassword(); // 12 caracteres seguros

// Cria usuário no Supabase Auth
await supabase.auth.admin.createUser({
  email: customerEmail,
  password: password,
  email_confirm: true,
  user_metadata: {
    name: customerName,
    role: 'ADMIN',
    cakto_purchase_id: purchaseId,
  },
});

// Atualiza perfil para ADMIN
await supabase.from('profiles').update({
  role: 'ADMIN',
  name: customerName,
  email: customerEmail,
});

// Cria subscription vinculada ao plano
await createCaktoSubscription(supabase, userId, eventData, planId);
```

### 6️⃣ Envia Email de Boas-Vindas

```javascript
// Envia email com credenciais
await fetch('/functions/v1/send-welcome-email', {
  method: 'POST',
  body: JSON.stringify({
    email: customerEmail,
    name: customerName,
    password: password, // Senha gerada
  }),
});
```

### 7️⃣ Cliente Recebe Email

O cliente recebe **2 emails**:

**Email 1 - Do Cakto:**
- Link de acesso: `https://eleveaone.com.br/acesso?email=...&purchase_id=...`
- Informações da compra

**Email 2 - Do Sistema:**
- Email de login
- Senha gerada
- Link para acessar o sistema

## 🔐 Validação de Segurança

### Assinatura do Webhook (Opcional mas Recomendado)

```javascript
// Busca webhook secret configurado
const webhookSecret = process.env.CAKTO_WEBHOOK_SECRET;

// Valida assinatura recebida
if (signature === webhookSecret) {
  // ✅ Webhook válido, processa
} else {
  // ❌ Webhook inválido, rejeita
  return { statusCode: 401, error: 'Invalid signature' };
}
```

## 📊 Estrutura do Evento Recebido

O webhook pode receber diferentes formatos. Nosso código tenta extrair:

```javascript
// Email do cliente
const email = eventData.customer?.email || 
              eventData.email || 
              eventData.customer_email;

// Nome do cliente
const name = eventData.customer?.name || 
            eventData.name || 
            eventData.customer_name;

// ID da compra
const purchaseId = eventData.purchase_id || 
                  eventData.id || 
                  eventData.purchase?.id;

// Nome do plano
const planName = eventData.plan_name ||
                eventData.product?.name ||
                eventData.purchase?.product_name;

// Valor
const amount = eventData.amount || 
              eventData.value || 
              eventData.purchase?.amount;
```

## 🎯 Mapeamento de Planos

O sistema mapeia automaticamente o plano do Cakto para o plano do sistema:

```javascript
function mapCaktoPlanToSystemPlan(planName, amount) {
  // Por nome
  if (planName.includes('ENTERPRISE')) return 'ENTERPRISE';
  if (planName.includes('BUSINESS')) return 'BUSINESS';
  if (planName.includes('STARTER')) return 'STARTER';
  
  // Por valor (fallback)
  if (amount >= 700) return 'ENTERPRISE';
  if (amount >= 450) return 'BUSINESS';
  return 'STARTER';
}
```

## ✅ Checklist de Configuração

- [ ] Webhook configurado no Cakto apontando para: `https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO`
- [ ] Eventos selecionados: `purchase.approved`, `purchase.completed`
- [ ] Webhook Secret configurado (opcional mas recomendado)
- [ ] Variáveis de ambiente no Netlify (se usar API como fallback)
- [ ] Link de acesso configurado no produto do Cakto: `https://eleveaone.com.br/acesso?email={{email}}&purchase_id={{purchase_id}}`

## 🔍 Debugging

### Ver Logs do Webhook

1. Acesse: https://app.netlify.com/sites/[seu-site]/functions
2. Clique em `payment-webhook`
3. Vá em **"Logs"**
4. Procure por:
   - `[Payment Webhook] CAKTO:` - Logs do processamento
   - `[Cakto API]` - Logs da API (se usada)

### Verificar Eventos Processados

```sql
SELECT 
    id,
    payment_gateway,
    event_type,
    external_event_id,
    processed,
    created_at
FROM sistemaretiradas.billing_events
WHERE payment_gateway = 'CAKTO'
ORDER BY created_at DESC
LIMIT 20;
```

### Verificar Usuários Criados

```sql
SELECT 
    id,
    email,
    name,
    role,
    created_at
FROM sistemaretiradas.profiles
WHERE role = 'ADMIN'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## 🚨 Tratamento de Erros

O webhook trata vários cenários:

1. **Usuário já existe**: Atualiza subscription existente
2. **Dados incompletos**: Tenta buscar da API (se configurada)
3. **Erro ao criar usuário**: Loga erro mas não bloqueia
4. **Erro ao enviar email**: Não bloqueia criação do usuário
5. **Webhook inválido**: Rejeita com 401

## 📝 Exemplo de Payload Completo

```json
{
  "type": "purchase.approved",
  "id": "evt_123456",
  "purchase_id": "pur_789012",
  "customer": {
    "email": "cliente@exemplo.com",
    "name": "João Silva",
    "id": "cust_345678"
  },
  "product": {
    "id": "prod_901234",
    "name": "Plano Business",
    "price": 499.00
  },
  "amount": 499.00,
  "status": "approved",
  "created_at": "2025-12-18T23:30:00Z",
  "secret": "webhook_secret_here" // Se configurado
}
```

## 🎯 Resultado Final

Após o webhook processar com sucesso:

1. ✅ Usuário ADMIN criado no sistema
2. ✅ Subscription vinculada ao plano correto
3. ✅ Email de boas-vindas enviado com credenciais
4. ✅ Cliente pode acessar o sistema imediatamente

