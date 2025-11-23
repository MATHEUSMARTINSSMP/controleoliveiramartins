# Configuração do Webhook n8n para WhatsApp

## Problema Identificado

O webhook `api/whatsapp/send` no n8n pode estar bloqueando requisições vindas do Netlify (`controleinterno.netlify.app`) devido a configurações de CORS ou autenticação.

## Webhook Necessário

O frontend precisa chamar o webhook:
- **URL**: `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send`
- **Método**: `POST`
- **Header de Autenticação**: `X-APP-KEY: #mmP220411`
- **Content-Type**: `application/json`

## Payload Esperado

```json
{
  "siteSlug": "elevea",
  "customerId": "mathmartins@gmail.com",
  "phoneNumber": "5596981032928",
  "message": "Mensagem de teste"
}
```

## Configurações Necessárias no n8n

### 1. Verificar se o Webhook Existe

No workflow do n8n, verifique se existe um node de webhook com:
- **Path**: `api/whatsapp/send`
- **Método**: `POST`
- **Response Mode**: Pode ser `responseNode` ou `lastNode`

### 2. Configurar CORS no Webhook Node

No n8n, o webhook node tem opções de CORS. Configure:

1. Abra o node do webhook `api/whatsapp/send`
2. Procure pela seção "Options" ou "CORS"
3. Adicione as seguintes origens permitidas:
   - `https://controleinterno.netlify.app`
   - `https://*.netlify.app` (para permitir deploys de preview)
   - `http://localhost:8080` (para desenvolvimento local)

### 3. Configurar Autenticação no Webhook Node

O webhook precisa aceitar o header `X-APP-KEY` com o valor `#mmP220411`.

No n8n:
1. No webhook node, procure por "Authentication"
2. Se usar "Header Auth", configure:
   - **Header Name**: `X-APP-KEY`
   - **Value**: `#mmP220411`

OU

Se usar um Code node após o webhook para validar:
```javascript
const headers = $input.item.json.headers || {};
const authKey = headers['x-app-key'] || headers['X-APP-KEY'];

if (authKey !== '#mmP220411') {
  throw new Error('Unauthorized: Invalid X-APP-KEY header');
}

return $input.all();
```

### 4. Verificar o Workflow

O webhook deve estar conectado aos seguintes nodes (em ordem):
1. **Webhook - Send** (recebe a requisição)
2. **Code - Normalize Send Input** (normaliza os dados)
3. **PostgreSQL - Get Credentials Send** (busca credenciais)
4. **If - Has Credentials** (verifica se encontrou credenciais)
5. **Code - Prepare Send Data** (prepara dados para UAZAPI)
6. **HTTP - Send via UAZAPI** (envia mensagem)
7. **PostgreSQL - Save Message** (salva mensagem no banco)
8. **Respond - Send** (retorna resposta)

## Teste Manual

### Teste via cURL (deve funcionar):

```bash
curl -X POST "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -H "X-APP-KEY: #mmP220411" \
  -d '{
    "siteSlug": "elevea",
    "customerId": "mathmartins@gmail.com",
    "phoneNumber": "5596981032928",
    "message": "Teste de mensagem"
  }'
```

### Teste via Node.js (simula o que o Netlify Function faz):

```javascript
const response = await fetch('https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-APP-KEY': '#mmP220411',
  },
  body: JSON.stringify({
    siteSlug: 'elevea',
    customerId: 'mathmartins@gmail.com',
    phoneNumber: '5596981032928',
    message: 'Teste de mensagem'
  }),
});
```

## Problemas Comuns

### 1. Erro CORS
**Sintoma**: Erro no console do navegador sobre CORS
**Solução**: Configurar CORS no webhook node do n8n (ver item 2 acima)

### 2. 401 Unauthorized
**Sintoma**: Webhook retorna 401
**Solução**: Verificar se o header `X-APP-KEY` está sendo enviado corretamente e se o valor está correto no n8n

### 3. 404 Not Found
**Sintoma**: Webhook retorna 404
**Solução**: Verificar se o path do webhook está correto: `api/whatsapp/send`

### 4. Webhook não está ativo
**Sintoma**: Nenhuma execução aparece no n8n
**Solução**: Verificar se o workflow está ativo no n8n e se o webhook está ativo

## Verificação no n8n

1. Acesse: `https://fluxos.eleveaagencia.com.br/workflow/5Fg6A75skS0OIKZF/executions`
2. Verifique as execuções recentes
3. Se não houver execuções, o webhook não está sendo chamado
4. Se houver execuções com erro, verifique os logs de cada node

## Checklist

- [ ] Webhook `api/whatsapp/send` existe no workflow
- [ ] Webhook está ativo (workflow está ativo)
- [ ] CORS configurado para aceitar `controleinterno.netlify.app`
- [ ] Autenticação `X-APP-KEY` configurada
- [ ] Path do webhook está correto
- [ ] Teste via cURL funciona
- [ ] Logs no n8n mostram requisições recebidas

