# 🔧 Como Configurar o Webhook n8n para Aceitar Requisições do Netlify

## ⚠️ Problema

O webhook `api/whatsapp/send` pode estar bloqueando requisições vindas do Netlify (`controleinterno.netlify.app`) devido a configurações de CORS ou autenticação.

## ✅ Solução Passo a Passo

### 1. Verificar se o Webhook Existe

No workflow do n8n, verifique se existe um node do tipo **"Webhook"** com:
- **Path**: `api/whatsapp/send`
- **Método**: `POST`

Se não existir, você precisa criá-lo ou verificar se está em outro workflow.

### 2. Configurar CORS no Webhook Node

**No n8n:**

1. Clique no node do webhook `api/whatsapp/send`
2. Procure pela seção **"Options"** (Geralmente no final da configuração)
3. Procure por **"CORS"** ou **"Allowed Origins"**
4. Adicione as seguintes URLs nas origens permitidas:
   ```
   https://controleinterno.netlify.app
   https://*.netlify.app
   http://localhost:8888
   ```

   **OU** configure para aceitar todas as origens (menos seguro, mas funciona):
   ```
   *
   ```

5. Salve o webhook

### 3. Verificar Configuração de Autenticação

O webhook deve aceitar o header `X-APP-KEY` com o valor `#mmP220411`.

**Opção A: Configurar no próprio Webhook Node (se disponível)**

No node do webhook, procure por **"Authentication"** ou **"Header Auth"**:
- **Header Name**: `X-APP-KEY`
- **Value**: `#mmP220411`

**Opção B: Adicionar Node Code para Validar**

Após o webhook node, adicione um **Code node** para validar o header:

```javascript
const headers = $input.item.json.headers || {};
const authKey = headers['x-app-key'] || headers['X-APP-KEY'];

if (authKey !== '#mmP220411') {
  throw new Error('Unauthorized: Invalid X-APP-KEY header');
}

return $input.all();
```

### 4. Configurar Response Headers (Importante para CORS)

No webhook node ou no node de resposta, configure os seguintes headers:

1. Clique no node de resposta (geralmente o último node do workflow)
2. Procure por **"Response Headers"** ou **"Headers"**
3. Adicione os seguintes headers:
   ```
   Access-Control-Allow-Origin: https://controleinterno.netlify.app
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type, X-APP-KEY
   ```

   **OU** para aceitar qualquer origem:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type, X-APP-KEY
   ```

### 5. Habilitar o Workflow

Certifique-se de que o workflow está **ATIVO** (toggle verde no topo do workflow).

### 6. Verificar o Path do Webhook

O path do webhook deve ser exatamente:
```
api/whatsapp/send
```

A URL completa será:
```
https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send
```

## 🧪 Teste Manual

Execute este teste no terminal para verificar se o webhook está funcionando:

```bash
curl -X POST "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "X-APP-KEY: #mmP220411" \
  -H "Origin: https://controleinterno.netlify.app" \
  -d '{
    "siteSlug": "elevea",
    "customerId": "mathmartins@gmail.com",
    "phoneNumber": "5596981032928",
    "message": "Teste de mensagem"
  }' \
  -v
```

**O que verificar:**
- Status HTTP deve ser `200` ou `201`
- Headers de resposta devem incluir `Access-Control-Allow-Origin`
- Não deve aparecer erro CORS

## 🔍 Verificações no n8n

### 1. Ver Execuções do Workflow

Acesse:
```
https://fluxos.eleveaagencia.com.br/workflow/5Fg6A75skS0OIKZF/executions
```

Verifique:
- Se aparecem novas execuções quando você testa
- Se há erros nos logs de cada node
- Se a requisição está chegando ao webhook node

### 2. Verificar Logs do Webhook Node

No webhook node, clique em **"Test"** ou verifique as execuções para ver:
- Se o payload está chegando corretamente
- Se os headers estão presentes
- Se o `X-APP-KEY` está sendo recebido

### 3. Verificar CORS no Navegador

No console do navegador (F12), quando uma requisição falhar, você verá:
```
Access to fetch at '...' from origin 'https://controleinterno.netlify.app' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header 
is present on the requested resource.
```

Se aparecer este erro, o CORS não está configurado corretamente no n8n.

## 📋 Checklist de Configuração

- [ ] Webhook `api/whatsapp/send` existe no workflow
- [ ] Webhook está ativo (workflow está ativo)
- [ ] CORS configurado para aceitar `https://controleinterno.netlify.app`
- [ ] Response headers incluem `Access-Control-Allow-Origin`
- [ ] Autenticação `X-APP-KEY` configurada
- [ ] Teste via cURL funciona
- [ ] Execuções aparecem no n8n quando testa
- [ ] Logs mostram que a requisição chega ao webhook

## 🆘 Problemas Comuns

### Erro: CORS policy blocked

**Solução:**
1. Configure CORS no webhook node (item 2 acima)
2. Configure response headers (item 4 acima)
3. Certifique-se de que a URL está exata: `https://controleinterno.netlify.app`

### Erro: 401 Unauthorized

**Solução:**
1. Verifique se o header `X-APP-KEY` está sendo enviado
2. Verifique se o valor está correto: `#mmP220411`
3. Configure autenticação no webhook node (item 3 acima)

### Erro: 404 Not Found

**Solução:**
1. Verifique se o path está correto: `api/whatsapp/send`
2. Verifique se o webhook está ativo
3. Verifique se está no workflow correto

### Nenhuma execução aparece no n8n

**Solução:**
1. Verifique se o workflow está ativo
2. Verifique se o webhook está ativo
3. Verifique se a URL do webhook está correta
4. Execute o teste via cURL para verificar se chega ao webhook

## 📞 Contato

Se o problema persistir após seguir todos os passos:
1. Capture os logs do console do navegador (F12)
2. Capture as execuções do n8n (com erros)
3. Verifique se o webhook está realmente configurado para aceitar requisições externas

