# 🚀 Guia de Configuração da API do Cakto

Este guia mostra passo a passo como configurar e testar a integração com a API do Cakto.

## 📋 Pré-requisitos

- ✅ Conta ativa no Cakto
- ✅ Chaves de API criadas (Client ID e Client Secret)
- ✅ Acesso ao painel do Netlify

## 🔑 Passo 1: Obter Credenciais da API

### 1.1 Acesse o Painel do Cakto

1. Acesse: https://app.cakto.com.br/dashboard/cakto-api
2. Faça login na sua conta

### 1.2 Criar ou Visualizar Chave de API

1. Na seção "Chaves de API", clique em **"Criar Chave API"** (se ainda não criou)
   - Ou veja as chaves existentes na lista

2. Configure a chave:
   - **DESCRIÇÃO**: Nome descritivo (ex: "API EleveaOne")
   - **ESCOPOS SELECIONADOS**: Selecione os escopos necessários:
     - ✅ Leitura (Read)
     - ✅ Escrita (Write)
     - ✅ Produtos (Products)
     - ✅ Pedidos (Orders)
     - ✅ Ofertas (Offers)

3. Clique em **"Salvar"**

4. **⚠️ IMPORTANTE**: Copie e salve imediatamente:
   - **CLIENT ID**: `Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ`
   - **CLIENT SECRET**: `iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH`

   > ⚠️ **As chaves não podem ser visualizadas novamente depois!** Salve em local seguro.

## ⚙️ Passo 2: Configurar Variáveis de Ambiente no Netlify

### 2.1 Acessar Configurações do Netlify

1. Acesse: https://app.netlify.com/
2. Selecione seu site (eleveaone.com.br)
3. Vá em **Site settings** → **Environment variables**

### 2.2 Adicionar Variáveis

Adicione as seguintes variáveis de ambiente:

| Key | Value |
|-----|-------|
| `CAKTO_CLIENT_ID` | `Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ` |
| `CAKTO_CLIENT_SECRET` | `iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH` |

**Como adicionar:**
1. Clique em **"Add a variable"**
2. Digite o **Key** (nome da variável)
3. Digite o **Value** (valor)
4. Clique em **"Save"**
5. Repita para a segunda variável

### 2.3 Redeploy (Importante!)

Após adicionar as variáveis:

1. Vá em **Deploys**
2. Clique nos 3 pontos (...) no último deploy
3. Selecione **"Trigger deploy"** → **"Deploy site"**
   - Ou faça um novo commit/push para forçar redeploy

> ⚠️ **As variáveis só ficam disponíveis após redeploy!**

## 🧪 Passo 3: Testar a Autenticação

### 3.1 Teste via cURL (Terminal)

Teste se as credenciais estão funcionando:

```bash
curl -X POST https://api.cakto.com.br/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=Xtzkipk7FSN7RdERL04gvHuABPzD19BmcDdjBXBZ" \
  -d "client_secret=iYF9CyF3JYwPIM5ttv9OfyasrDjNBxeqkO5AVvwajDIz9bBCjrcSYePkqjwOPpVI1tzH92W8kPqx34KTjPt06sGGo1IWFZo0CkfCbdGVM1aJwTpsrmLh98pblWFmKwBH"
```

**Resposta esperada:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Se receber `401 Unauthorized`, as credenciais estão incorretas.

### 3.2 Teste via Webhook (Prático)

Faça uma compra de teste no Cakto e verifique os logs:

1. Acesse: https://app.netlify.com/sites/[seu-site]/functions
2. Clique na função `payment-webhook`
3. Vá em **"Logs"**
4. Faça uma compra de teste
5. Procure por logs com:
   - `[Cakto API]` - Logs da API
   - `[Payment Webhook] CAKTO:` - Logs do webhook

## 📡 Passo 4: Configurar Webhook no Cakto

### 4.1 Acessar Configurações de Webhook

1. No painel do Cakto, vá em **Integrações** → **Webhooks**
2. Clique em **"Adicionar Webhook"** ou **"Criar Webhook"**

### 4.2 Configurar Webhook

- **URL do Webhook**: 
  ```
  https://eleveaone.com.br/.netlify/functions/payment-webhook?gateway=CAKTO
  ```

- **Eventos para monitorar**:
  - ✅ `purchase.approved` ou `purchase_approved`
  - ✅ `purchase.completed`

- **Webhook Secret** (opcional, mas recomendado):
  - Gere um secret aleatório seguro
  - Salve como variável `CAKTO_WEBHOOK_SECRET` no Netlify

### 4.3 Salvar e Testar

1. Clique em **"Salvar"**
2. Use a opção de **"Evento de Teste"** se disponível
3. Verifique os logs no Netlify

## 🔍 Passo 5: Verificar Documentação dos Endpoints

Conforme a documentação oficial: https://docs.cakto.com.br/

### Endpoints Importantes:

1. **Autenticação:**
   ```
   POST https://api.cakto.com.br/oauth/token
   ```

2. **Listar Pedidos:**
   ```
   GET https://api.cakto.com.br/api/orders
   Authorization: Bearer {access_token}
   ```

3. **Obter Pedido:**
   ```
   GET https://api.cakto.com.br/api/orders/{id}
   Authorization: Bearer {access_token}
   ```

> 📚 Consulte a documentação completa: https://docs.cakto.com.br/

## ✅ Checklist de Configuração

- [ ] Credenciais da API obtidas (Client ID e Secret)
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Redeploy feito após adicionar variáveis
- [ ] Teste de autenticação passou (retornou access_token)
- [ ] Webhook configurado no Cakto
- [ ] Compra de teste realizada
- [ ] Logs verificados no Netlify
- [ ] Usuário criado automaticamente após compra

## 🐛 Troubleshooting

### Erro: "CAKTO_CLIENT_ID and CAKTO_CLIENT_SECRET must be set"

**Solução**: Variáveis não estão configuradas ou não foram aplicadas no deploy.
- Verifique se adicionou as variáveis no Netlify
- Faça um redeploy após adicionar

### Erro: "401 Unauthorized" na autenticação

**Solução**: Credenciais incorretas.
- Verifique se copiou o Client ID e Secret corretamente
- Confirme que não há espaços extras
- Verifique se a chave de API está ativa no Cakto

### Erro: "Failed to get purchase" (404)

**Solução**: Endpoint da API pode estar diferente.
- Verifique na documentação: https://docs.cakto.com.br/
- Pode ser `/api/orders/{id}` ou `/api/purchases/{id}`
- O código tenta ambos automaticamente

### Webhook não está recebendo eventos

**Solução**: 
- Verifique se a URL do webhook está correta
- Confirme que os eventos estão selecionados
- Teste o webhook manualmente no painel do Cakto
- Verifique os logs do Netlify para ver se chegou requisição

## 📞 Suporte

- **Documentação Cakto**: https://docs.cakto.com.br/
- **Suporte Cakto**: Entre em contato pelo painel do Cakto
- **Logs Netlify**: https://app.netlify.com/sites/[seu-site]/functions/payment-webhook

