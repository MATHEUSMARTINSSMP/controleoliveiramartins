# ✅ Integração Cakto - Versão Final Completa

## 🎯 Funcionalidade Implementada

**Quando uma venda é confirmada no Cakto, o sistema automaticamente:**

1. ✅ Recebe webhook do Cakto
2. ✅ Valida assinatura (se configurada)
3. ✅ Extrai dados do webhook
4. ✅ Verifica se usuário já existe
5. ✅ **Cria usuário ADMIN** (se novo)
6. ✅ **Cria/Atualiza perfil** com role ADMIN
7. ✅ **Remove subscription trial** (se existir)
8. ✅ **Cria subscription paga** do plano correto
9. ✅ **Gera senha aleatória** segura
10. ✅ **Envia email** de boas-vindas com credenciais

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────┐
│ 1. Cliente faz compra no Cakto                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. Pagamento aprovado                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. Cakto envia webhook POST                     │
│    URL: .../payment-webhook?gateway=CAKTO       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 4. Netlify Function recebe                      │
│    ├─ Valida assinatura                         │
│    ├─ Extrai dados (email, nome, plano, valor)  │
│    └─ Identifica evento: purchase_approved      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 5. Verifica se usuário existe?                  │
│    ├─ SIM → Atualiza subscription               │
│    └─ NÃO → Cria novo usuário                   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼ (se novo usuário)
┌─────────────────────────────────────────────────┐
│ 6. Criação de Usuário ADMIN                     │
│    ├─ Gera senha aleatória (12 chars)           │
│    ├─ Cria no Supabase Auth                     │
│    ├─ Aguarda 500ms                             │
│    └─ Verifica/Cria perfil                      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 7. Gerenciamento de Subscription                │
│    ├─ Remove subscription trial (se existir)    │
│    ├─ Mapeia plano (STARTER/BUSINESS/ENTERPRISE)│
│    └─ Cria/Atualiza subscription paga           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 8. Envio de Email                               │
│    ├─ Tenta Netlify Function                    │
│    ├─ Fallback: Supabase Function               │
│    └─ Envia credenciais (email + senha)         │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 9. ✅ Usuário pode acessar o sistema!           │
└─────────────────────────────────────────────────┘
```

## 📊 Estrutura de Dados

### Webhook Recebido

```json
{
  "secret": "seu_secret_aqui",
  "event": "purchase_approved",
  "data": {
    "id": "purchase_id_123",
    "refId": "REF123",
    "customer": {
      "email": "cliente@email.com",
      "name": "Nome do Cliente",
      "phone": "34999999999"
    },
    "product": {
      "name": "Plano Business",
      "id": "prod_123",
      "short_id": "49bruPi"
    },
    "offer": {
      "id": "B8BcHrY",
      "name": "Offer Example",
      "price": 499.00
    },
    "amount": 499.00,
    "baseAmount": 499.00,
    "status": "paid",
    "paymentMethod": "pix"
  }
}
```

### Dados Extraídos

| Campo | Fonte | Exemplo |
|-------|-------|---------|
| Email | `data.customer.email` | `cliente@email.com` |
| Nome | `data.customer.name` | `Nome do Cliente` |
| Purchase ID | `data.id` ou `data.refId` | `purchase_id_123` |
| Plano | `data.product.name` ou `data.offer.name` | `Plano Business` |
| Valor | `data.amount` ou `data.baseAmount` | `499.00` |

### O que é Criado no Sistema

#### 1. Usuário no Supabase Auth

```javascript
{
  email: "cliente@email.com",
  password: "Kx9#mP2$vL8@", // Gerada aleatoriamente
  email_confirm: true,
  user_metadata: {
    name: "Nome do Cliente",
    role: "ADMIN",
    cakto_purchase_id: "purchase_id_123"
  }
}
```

#### 2. Perfil em `profiles`

```sql
INSERT INTO sistemaretiradas.profiles (
  id,              -- UUID do usuário
  email,           -- cliente@email.com
  name,            -- Nome do Cliente
  role             -- ADMIN
);
```

#### 3. Subscription em `admin_subscriptions`

```sql
INSERT INTO sistemaretiradas.admin_subscriptions (
  admin_id,                    -- UUID do admin
  plan_id,                     -- STARTER/BUSINESS/ENTERPRISE
  payment_gateway,             -- CAKTO
  external_subscription_id,    -- purchase_id_123
  status,                      -- ACTIVE
  payment_status,              -- PAID (não TRIAL)
  gateway_data                 -- JSON completo do webhook
);
```

## 🎯 Mapeamento de Planos

```javascript
function mapCaktoPlanToSystemPlan(planName, amount) {
  // Por nome (case-insensitive)
  if (planName.includes('ENTERPRISE') || planName.includes('EMPRESARIAL')) 
    return 'ENTERPRISE';
  if (planName.includes('BUSINESS') || planName.includes('NEGÓCIO')) 
    return 'BUSINESS';
  if (planName.includes('STARTER') || planName.includes('INICIAL') || planName.includes('BÁSICO')) 
    return 'STARTER';
  
  // Por valor (fallback)
  const amountNum = parseFloat(amount) || 0;
  if (amountNum >= 700) return 'ENTERPRISE';
  if (amountNum >= 450) return 'BUSINESS';
  return 'STARTER';
}
```

## 🔐 Segurança

### Validação de Webhook

- ✅ Valida assinatura se `CAKTO_WEBHOOK_SECRET` estiver configurado
- ✅ Aceita requisições se secret não estiver configurado (modo permissivo)
- ✅ Loga todas as tentativas de acesso

### Senha Gerada

- **12 caracteres** de comprimento
- **Inclui**: Maiúsculas, minúsculas, números, especiais
- **Gerada aleatoriamente** para cada usuário
- **Enviada apenas por email** (não logada)

## 📧 Envio de Email

**Estratégia de Fallback:**

1. **Primeiro**: Tenta Netlify Function
   - URL: `/.netlify/functions/send-welcome-email`
   - Mais rápido e confiável

2. **Fallback**: Supabase Function
   - URL: `/functions/v1/send-welcome-email`
   - Se Netlify Function falhar

3. **Se ambos falharem**: Loga erro mas **não bloqueia** o processo

**Conteúdo do Email:**
- ✅ Nome do cliente
- ✅ Email de login
- ✅ Senha gerada
- ✅ Link para acessar o sistema
- ✅ Design profissional

## ⚠️ Tratamento de Trial

Quando um admin é criado, há um trigger que cria automaticamente uma subscription TRIAL de 14 dias. No entanto, quando o Cakto cria uma subscription paga, precisamos:

1. ✅ **Remover subscription trial** (se existir)
2. ✅ **Criar subscription paga** no lugar

Isso garante que o usuário tenha acesso imediato com o plano pago, sem passar pelo trial.

## ✅ Validações Implementadas

- ✅ Email obrigatório (retorna erro se não tiver)
- ✅ Verifica se usuário já existe (evita duplicados)
- ✅ Verifica se perfil existe antes de atualizar
- ✅ Cria perfil se não existir (fallback)
- ✅ Remove subscription trial antes de criar paga
- ✅ Valida assinatura do webhook (se configurada)

## 🧪 Como Testar

### 1. Teste Manual (curl)

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

### 2. Verificar no Banco

```sql
-- Ver usuário criado
SELECT id, email, name, role, created_at 
FROM sistemaretiradas.profiles 
WHERE email = 'teste@exemplo.com';

-- Ver subscription criada (deve ser PAID, não TRIAL)
SELECT 
  a.id,
  p.email,
  a.plan_id,
  a.status,
  a.payment_status,
  a.payment_gateway,
  a.external_subscription_id
FROM sistemaretiradas.admin_subscriptions a
JOIN sistemaretiradas.profiles p ON p.id = a.admin_id
WHERE p.email = 'teste@exemplo.com';
```

### 3. Verificar Logs

```
Netlify Dashboard → Functions → payment-webhook → Logs
```

Procure por:
- `✅ User created`
- `✅ Profile created` ou `✅ Profile updated to ADMIN`
- `Trial subscription found, deleting`
- `✅ Subscription created` ou `✅ Subscription updated`
- `✅ Welcome email sent`

## 📋 Checklist de Configuração

### No Cakto

- [ ] Webhook URL configurada: `https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO`
- [ ] Eventos selecionados:
  - [ ] `purchase_approved`
  - [ ] `subscription_renewed`
  - [ ] `subscription_canceled`
- [ ] (Opcional) Webhook secret configurado

### No Netlify

- [ ] Variáveis de ambiente configuradas:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `RESEND_API_KEY`
  - [ ] (Opcional) `CAKTO_WEBHOOK_SECRET`
  - [ ] (Opcional) `CAKTO_CLIENT_ID`
  - [ ] (Opcional) `CAKTO_CLIENT_SECRET`

### No Supabase

- [ ] Planos criados na tabela `subscription_plans`:
  - [ ] `STARTER`
  - [ ] `BUSINESS`
  - [ ] `ENTERPRISE`
- [ ] Trigger de trial configurado (já existe na migration)

## 🎉 Resultado Final

Após o webhook processar com sucesso:

1. ✅ **Usuário ADMIN criado** no Supabase Auth
2. ✅ **Perfil criado** com role ADMIN
3. ✅ **Subscription trial removida** (se existir)
4. ✅ **Subscription paga criada** vinculada ao plano correto
5. ✅ **Email enviado** com credenciais
6. ✅ **Cliente pode acessar** o sistema imediatamente

## 📝 Próximos Passos

1. ✅ **Código implementado**
2. ⏳ **Deploy** - Fazer commit e push
3. ⏳ **Configurar no Cakto** - Webhook URL e eventos
4. ⏳ **Testar com compra real** - Verificar todo o fluxo
5. ⏳ **Monitorar logs** - Acompanhar primeiras vendas

---

**✅ INTEGRAÇÃO 100% COMPLETA E PRONTA PARA PRODUÇÃO!**

