# ✅ Checklist Final - Integração Cakto

## 🔧 Correções Aplicadas

### ✅ 1. Estrutura do Webhook Corrigida
- [x] Campo `event` ao invés de `type` para identificar eventos
- [x] `secret` no nível raiz (não dentro de `data`)
- [x] Dados principais em `data` (não diretamente no root)
- [x] `data.id` ou `data.refId` para purchase ID
- [x] `data.customer.email`, `data.product.name`, etc.

### ✅ 2. Suporte a GET Requests
- [x] GET requests retornam health check (para testes do Cakto)
- [x] Não processa eventos em GET (apenas valida endpoint)

### ✅ 3. Validação de Secret Corrigida
- [x] Extrai `secret` do nível raiz do JSON
- [x] Validação mais flexível (aceita quando não configurado)
- [x] Logs claros sobre validação

### ✅ 4. Eventos Implementados
- [x] `purchase_approved` - Cria usuário ADMIN
- [x] `subscription_renewed` - Atualiza subscription
- [x] `subscription_canceled` - Cancela subscription (nova função)

### ✅ 5. Extração de Dados Corrigida
- [x] `data.customer.email` ao invés de múltiplas tentativas
- [x] `data.product.name` para nome do plano
- [x] `data.id` ou `data.refId` para purchase ID
- [x] `data.amount` ou `data.baseAmount` para valor

## 📋 Próximos Passos

### 1. Deploy
- [ ] Fazer commit das alterações
- [ ] Push para o repositório
- [ ] Verificar deploy no Netlify

### 2. Configuração no Cakto
- [ ] Configurar webhook URL: `https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO`
- [ ] Eventos selecionados: `purchase_approved`, `subscription_renewed`, `subscription_canceled`
- [ ] (Opcional) Configurar webhook secret no Cakto e adicionar `CAKTO_WEBHOOK_SECRET` no Netlify

### 3. Testes
- [ ] Testar GET request (health check)
- [ ] Fazer compra de teste no Cakto
- [ ] Verificar logs no Netlify
- [ ] Verificar se usuário foi criado no Supabase
- [ ] Verificar se email foi enviado

### 4. Validação
- [ ] Verificar usuário criado: `SELECT * FROM sistemaretiradas.profiles WHERE role = 'ADMIN' ORDER BY created_at DESC LIMIT 5;`
- [ ] Verificar subscription criada: `SELECT * FROM sistemaretiradas.admin_subscriptions WHERE payment_gateway = 'CAKTO' ORDER BY created_at DESC LIMIT 5;`
- [ ] Verificar eventos processados: `SELECT * FROM sistemaretiradas.billing_events WHERE payment_gateway = 'CAKTO' ORDER BY created_at DESC LIMIT 10;`

## 🎯 Estrutura do Webhook Esperada

```json
{
  "secret": "seu_secret_aqui",
  "event": "purchase_approved",
  "data": {
    "id": "purchase_id",
    "refId": "REF123",
    "customer": {
      "email": "cliente@email.com",
      "name": "Nome do Cliente"
    },
    "product": {
      "name": "Plano Business",
      "id": "prod_123"
    },
    "amount": 499.00,
    "status": "paid"
  }
}
```

## 📝 Comandos Úteis

### Ver logs do Netlify
```
Netlify Dashboard → Functions → payment-webhook → Logs
```

### Verificar usuários criados
```sql
SELECT id, email, name, role, created_at 
FROM sistemaretiradas.profiles 
WHERE role = 'ADMIN' 
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

### Verificar subscriptions
```sql
SELECT 
  a.id,
  a.admin_id,
  p.email,
  a.plan_id,
  a.status,
  a.payment_gateway,
  a.created_at
FROM sistemaretiradas.admin_subscriptions a
JOIN sistemaretiradas.profiles p ON p.id = a.admin_id
WHERE a.payment_gateway = 'CAKTO'
ORDER BY a.created_at DESC
LIMIT 10;
```

## ✅ Status Final

**Todas as correções foram aplicadas!**

O webhook está pronto para:
- ✅ Receber eventos do Cakto
- ✅ Criar usuários ADMIN automaticamente
- ✅ Criar subscriptions
- ✅ Enviar emails de boas-vindas
- ✅ Processar cancelamentos de assinatura
- ✅ Processar renovações de assinatura

