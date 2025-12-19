# 🔄 Como Funciona o Webhook do Cakto - Explicação Completa

## 📍 URL do Webhook

```
https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
```

## 🔄 Fluxo Passo a Passo

### 1️⃣ Cliente Compra no Cakto

```
┌─────────┐
│ Cliente │
└────┬────┘
     │
     │ 1. Acessa landing page
     │ 2. Clica em "Assinar Agora"
     │ 3. É redirecionado para checkout Cakto
     │
     ▼
┌─────────┐
│  Cakto  │
│ Checkout│
└────┬────┘
     │
     │ 4. Cliente preenche dados e paga
     │ 5. Pagamento aprovado ✅
     │
     ▼
```

### 2️⃣ Cakto Envia Webhook

Quando o pagamento é aprovado, o Cakto **automaticamente** envia uma requisição POST:

```
POST https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO

Headers:
  Content-Type: application/json
  x-cakto-signature: [secret] (se configurado)

Body (JSON):
{
  "type": "purchase.approved",
  "purchase_id": "12345",
  "customer": {
    "email": "cliente@email.com",
    "name": "João Silva"
  },
  "product": {
    "name": "Plano Business",
    "id": "prod_123"
  },
  "amount": 499.00,
  "status": "approved"
}
```

### 3️⃣ Netlify Function Recebe

```javascript
// payment-webhook.js

// 1. Detecta que é do Cakto
const gateway = event.queryStringParameters?.gateway; // "CAKTO"

// 2. Valida segurança (assinatura)
validateCaktoSignature(supabase, event);

// 3. Processa o evento
handleCaktoEvent(supabase, eventData);
```

### 4️⃣ Extrai Dados do Webhook

```javascript
// Tenta extrair de vários lugares (flexível)
const customerEmail = eventData.customer?.email || 
                     eventData.email || 
                     eventData.customer_email;

const customerName = eventData.customer?.name || 
                    eventData.name || 
                    eventData.customer_name;

const purchaseId = eventData.purchase_id || 
                  eventData.id;

const planName = eventData.product?.name || 
                eventData.plan_name;
```

### 5️⃣ Busca Dados Adicionais (Opcional)

Se faltar email ou nome, tenta buscar da API do Cakto:

```javascript
if (purchaseId && !customerEmail) {
  // Busca da API (se configurada)
  const purchaseDetails = await getCaktoPurchase(purchaseId);
  // Enriquece dados
}
```

### 6️⃣ Verifica se Usuário Já Existe

```javascript
const existingProfile = await supabase
  .from('profiles')
  .select('id, email')
  .eq('email', customerEmail)
  .single();

if (existingProfile) {
  // Atualiza subscription existente
  updateCaktoSubscription(...);
} else {
  // Cria novo usuário
  createNewAdminUser(...);
}
```

### 7️⃣ Cria Novo Usuário ADMIN

```javascript
// Gera senha segura (12 caracteres)
const password = generateRandomPassword();
// Exemplo: "Kx9#mP2$vL8@"

// Cria no Supabase Auth
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

// Atualiza perfil
await supabase.from('profiles').update({
  role: 'ADMIN',
  name: customerName,
  email: customerEmail,
});
```

### 8️⃣ Vincula ao Plano Correto

```javascript
// Mapeia plano do Cakto para plano do sistema
const planId = mapCaktoPlanToSystemPlan(planName, amount);
// "Plano Business" → "BUSINESS"
// R$ 499 → "BUSINESS"

// Cria subscription
await supabase.from('admin_subscriptions').insert({
  admin_id: userId,
  plan_id: planId, // STARTER, BUSINESS ou ENTERPRISE
  payment_gateway: 'CAKTO',
  external_subscription_id: purchaseId,
  status: 'ACTIVE',
});
```

### 9️⃣ Envia Email de Boas-Vindas

```javascript
await fetch('/functions/v1/send-welcome-email', {
  method: 'POST',
  body: JSON.stringify({
    email: customerEmail,
    name: customerName,
    password: password, // Senha gerada
  }),
});
```

### 🔟 Cliente Recebe 2 Emails

**Email 1 - Do Cakto:**
```
Assunto: Sua compra foi aprovada!
Conteúdo:
  - Link: https://eleveaone.com.br/acesso?email=cliente@email.com&purchase_id=12345
  - Detalhes da compra
```

**Email 2 - Do Sistema:**
```
Assunto: Bem-vinda ao Sistema EleveaOne!
Conteúdo:
  - Email: cliente@email.com
  - Senha: Kx9#mP2$vL8@
  - Link para login: https://eleveaone.com.br/
```

## 🔐 Segurança

### Validação de Assinatura

```javascript
// Busca secret configurado
const webhookSecret = process.env.CAKTO_WEBHOOK_SECRET;

// Compara com assinatura recebida
if (signature === webhookSecret) {
  // ✅ Válido, processa
} else {
  // ❌ Inválido, rejeita (401)
}
```

## 📊 Estrutura de Dados Esperada

O webhook pode receber diferentes formatos. Nosso código é flexível e tenta extrair de vários lugares:

```javascript
// Email pode vir em:
eventData.customer.email
eventData.email
eventData.customer_email
eventData.purchase.customer.email

// Nome pode vir em:
eventData.customer.name
eventData.name
eventData.customer_name
eventData.purchase.customer.name

// Purchase ID pode vir em:
eventData.purchase_id
eventData.id
eventData.purchase.id
```

## ✅ O que Acontece se Tudo Der Certo

1. ✅ Webhook recebido e validado
2. ✅ Dados extraídos (email, nome, plano)
3. ✅ Usuário ADMIN criado no Supabase
4. ✅ Subscription vinculada ao plano
5. ✅ Email de boas-vindas enviado
6. ✅ Cliente pode acessar o sistema imediatamente

## ⚠️ O que Acontece se Algo Der Errado

### Usuário Já Existe
- ✅ Atualiza subscription existente
- ✅ Não cria duplicado

### Falta Email
- ⚠️ Tenta buscar da API (se configurada)
- ❌ Se não conseguir, retorna erro mas não bloqueia

### Erro ao Criar Usuário
- ❌ Loga erro
- ⚠️ Retorna erro para o Cakto (ele pode reenviar depois)

### Erro ao Enviar Email
- ⚠️ Loga erro
- ✅ Usuário ainda é criado (email é secundário)

## 🔍 Como Verificar se Está Funcionando

### 1. Ver Logs do Netlify

```
Netlify Dashboard → Functions → payment-webhook → Logs
```

Procure por:
- `[Payment Webhook] CAKTO:` - Processamento
- `✅ User created:` - Usuário criado
- `✅ Welcome email sent` - Email enviado

### 2. Verificar no Banco de Dados

```sql
-- Ver eventos recebidos
SELECT * FROM sistemaretiradas.billing_events 
WHERE payment_gateway = 'CAKTO' 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver usuários criados
SELECT id, email, name, role, created_at 
FROM sistemaretiradas.profiles 
WHERE role = 'ADMIN' 
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

### 3. Testar Manualmente

Você pode simular um webhook do Cakto usando curl:

```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO \
  -H "Content-Type: application/json" \
  -d '{
    "type": "purchase.approved",
    "purchase_id": "test_123",
    "customer": {
      "email": "teste@exemplo.com",
      "name": "Cliente Teste"
    },
    "product": {
      "name": "Plano Business"
    },
    "amount": 499.00,
    "status": "approved"
  }'
```

## 🎯 Resumo Visual

```
Cliente Compra
     │
     ▼
Cakto Aprova Pagamento
     │
     ▼
Cakto Envia Webhook → https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
     │
     ▼
Netlify Function Recebe
     │
     ├─→ Valida Assinatura
     ├─→ Extrai Dados
     ├─→ Busca da API (se necessário)
     ├─→ Cria Usuário ADMIN
     ├─→ Vincula Subscription
     └─→ Envia Email
     │
     ▼
Cliente Recebe Email com Credenciais
     │
     ▼
Cliente Acessa Sistema ✅
```

## 📝 Configuração Necessária

### No Cakto:

1. **Webhook URL**: 
   ```
   https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
   ```

2. **Eventos**:
   - `purchase.approved`
   - `purchase.completed`

3. **Webhook Secret** (opcional):
   - Configure um secret seguro
   - Adicione como `CAKTO_WEBHOOK_SECRET` no Netlify

### No Netlify:

Variáveis de ambiente (opcionais, para usar API como fallback):
- `CAKTO_CLIENT_ID`
- `CAKTO_CLIENT_SECRET`
- `CAKTO_WEBHOOK_SECRET` (se configurado)

## ✅ Pronto!

O webhook está configurado e funcionando. Quando uma compra for aprovada no Cakto, o sistema automaticamente:

1. Recebe o evento
2. Cria o usuário
3. Envia as credenciais
4. Cliente pode acessar imediatamente

🎉 **Tudo automático!**

