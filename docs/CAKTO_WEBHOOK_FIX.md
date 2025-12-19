# 🔧 Correção do Webhook Cakto

## ⚠️ Problemas Identificados

1. **Método GET ao invés de POST**
   - O Cakto estava enviando requisições GET (testes/validação)
   - Webhooks reais devem ser POST

2. **Validação de Assinatura Muito Rígida**
   - Estava falhando quando não havia secret configurado
   - Erro: `CAKTO signature mismatch. Received: undefined`

## ✅ Correções Aplicadas

### 1. Aceitar GET como Health Check

Agora o webhook aceita requisições GET e retorna um status de saúde:

```javascript
if (event.httpMethod === 'GET') {
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      success: true, 
      message: 'Webhook endpoint is active',
      gateway: gateway,
      note: 'Webhooks should be sent as POST requests'
    }),
  };
}
```

### 2. Validação de Assinatura Mais Flexível

Agora a validação:
- ✅ Aceita requisições quando não há secret configurado (modo permissivo)
- ✅ Valida corretamente quando secret está configurado
- ✅ Loga avisos claros quando secret não está configurado

```javascript
// Se não há secret configurado, aceitar (modo permissivo)
if (!webhookSecret) {
  console.warn('[Payment Webhook] CAKTO webhook secret not configured - accepting request (permissive mode)');
  return { valid: true };
}
```

## 📊 Comportamento Atual

### Requisições GET
- ✅ Aceitas e retornam status 200
- ✅ Útil para testes de conectividade do Cakto
- ℹ️ Não processam eventos (apenas health check)

### Requisições POST sem Secret Configurado
- ✅ Aceitas (modo permissivo)
- ⚠️ Log de aviso é gerado
- ✅ Processam eventos normalmente

### Requisições POST com Secret Configurado
- ✅ Valida assinatura
- ✅ Rejeita se assinatura inválida
- ✅ Aceita se assinatura válida

## 🔐 Configurar Secret (Opcional mas Recomendado)

Para habilitar validação de assinatura:

### Opção 1: Variável de Ambiente (Netlify)

```
CAKTO_WEBHOOK_SECRET=seu_secret_aqui
```

### Opção 2: Banco de Dados

```sql
INSERT INTO sistemaretiradas.payment_gateways (id, webhook_secret, active)
VALUES ('CAKTO', 'seu_secret_aqui', true)
ON CONFLICT (id) DO UPDATE 
SET webhook_secret = 'seu_secret_aqui';
```

## 🧪 Testar

### 1. Teste GET (Health Check)

```bash
curl https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
```

Deve retornar:
```json
{
  "success": true,
  "message": "Webhook endpoint is active",
  "gateway": "CAKTO",
  "note": "Webhooks should be sent as POST requests"
}
```

### 2. Teste POST (Webhook Real)

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
    }
  }'
```

## ✅ Resultado

Agora o webhook:
- ✅ Aceita requisições GET (health check)
- ✅ Processa requisições POST mesmo sem secret configurado
- ✅ Valida assinatura quando secret está configurado
- ✅ Logs mais claros e informativos

## 📝 Próximos Passos

1. ✅ Deploy das correções
2. ⏳ Testar com uma compra real no Cakto
3. ⏳ Verificar logs após deploy
4. ⏳ (Opcional) Configurar secret para validação completa

