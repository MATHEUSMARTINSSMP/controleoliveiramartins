# Integração com Cakto API

Esta documentação descreve como configurar e usar a integração com a API do Cakto para criar usuários automaticamente após compras.

## 🔑 Credenciais da API

As credenciais da API do Cakto devem ser configuradas como variáveis de ambiente no Netlify:

- `CAKTO_CLIENT_ID`: Client ID da API do Cakto
- `CAKTO_CLIENT_SECRET`: Client Secret da API do Cakto

**Credenciais atuais:**
- Client ID: `Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ`
- Client Secret: `iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH`

⚠️ **IMPORTANTE**: As credenciais foram copiadas mas podem ter erros de digitação. Verifique se estão corretas.

## 📚 Documentação da API

Documentação oficial: https://docs.cakto.com.br/

## 🔄 Fluxo de Autenticação

A API do Cakto usa OAuth2 com Client Credentials flow:

1. **Obter Access Token:**
   ```
   POST https://api.cakto.com.br/oauth/token
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials
   client_id={CLIENT_ID}
   client_secret={CLIENT_SECRET}
   scope=read write
   ```

2. **Usar Access Token nas requisições:**
   ```
   Authorization: Bearer {access_token}
   ```

## 🔗 Endpoints da API (a confirmar na documentação)

⚠️ **NOTA**: Os endpoints abaixo são exemplos baseados em padrões comuns. **Verificar na documentação oficial** do Cakto para confirmar os endpoints corretos.

### Buscar Compra/Pedido
```
GET https://api.cakto.com.br/purchases/{purchase_id}
Authorization: Bearer {access_token}
```

### Buscar Cliente
```
GET https://api.cakto.com.br/customers/{customer_id}
Authorization: Bearer {access_token}
```

## 🛠️ Configuração

### 1. Variáveis de Ambiente (Netlify)

No painel do Netlify, adicione as seguintes variáveis de ambiente:

```bash
CAKTO_CLIENT_ID=Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ
CAKTO_CLIENT_SECRET=iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH
```

### 2. Webhook do Cakto

Configure o webhook no Cakto apontando para:
```
https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
```

Eventos para monitorar:
- `purchase.approved` ou `purchase_approved`
- `purchase.completed`

### 3. Link de Acesso por Email

No painel do Cakto, configure o campo "Link de acesso enviado ao e-mail" com:
```
https://eleveaone.com.br/acesso?email={{email}}&purchase_id={{purchase_id}}
```

⚠️ **NOTA**: O formato das variáveis pode variar. Teste com `/acesso-test` primeiro para descobrir o formato correto.

## 📝 Uso do Helper

O helper `cakto-api-client.js` fornece funções para interagir com a API:

```javascript
const { makeCaktoRequest, getCaktoPurchase, getCaktoCustomer } = require('./cakto-api-client');

// Buscar compra
const purchase = await getCaktoPurchase(purchaseId, accessToken);

// Buscar cliente
const customer = await getCaktoCustomer(customerId, accessToken);

// Request genérico
const data = await makeCaktoRequest('/endpoint', 'GET');
```

## 🔍 Debugging

### Testar Autenticação

Você pode testar a autenticação criando um endpoint de teste ou usando curl:

```bash
curl -X POST https://api.cakto.com.br/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ" \
  -d "client_secret=iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH"
```

### Ver Logs

Os logs do webhook aparecem no Netlify Functions dashboard. Procure por:
- `[Cakto API]` - Logs da API
- `[Payment Webhook] CAKTO:` - Logs do webhook

## ⚠️ Próximos Passos

1. **Verificar Documentação Oficial**: Confirmar endpoints e estrutura da API do Cakto em https://docs.cakto.com.br/
2. **Ajustar URLs da API**: Os endpoints podem ser diferentes. Verificar na documentação.
3. **Testar Autenticação**: Garantir que as credenciais funcionam corretamente.
4. **Mapear Estrutura de Dados**: Confirmar a estrutura exata dos objetos `purchase` e `customer` retornados pela API.
5. **Testar Webhook**: Fazer uma compra de teste e verificar se o usuário é criado corretamente.

