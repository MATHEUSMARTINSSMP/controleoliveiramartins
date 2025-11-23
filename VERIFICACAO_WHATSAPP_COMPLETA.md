# Verificação Completa - Configuração WhatsApp

## ✅ Configurações Verificadas

### 1. URL do Webhook
- **URL**: `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send`
- **Método**: `POST`
- **Status**: ✅ Configurado corretamente

### 2. Headers de Autenticação
- **Header Name**: `x-app-key` (minúsculas)
- **Header Value**: `#mmP220411`
- **Status**: ✅ Corrigido (estava como 'X-APP-KEY', agora é 'x-app-key')

### 3. Formato do Payload
```json
{
  "siteSlug": "elevea",
  "customerId": "mathmartins@gmail.com",
  "phoneNumber": "5596981032928",  // COM DDI 55
  "message": "mensagem escapada com \\n"
}
```

### 4. Normalização de Telefone
- Remove caracteres não numéricos
- Remove zero inicial se presente
- Adiciona DDI 55 se não começar com 55
- **Formato final**: `55XXXXXXXXXXX` (ex: 5596981032928)

### 5. Escape de Mensagem
- Usa `JSON.stringify()` para escapar caracteres especiais
- Remove aspas externas com `slice(1, -1)`
- Converte `\n` para `\\n` para funcionar no n8n
- **Status**: ✅ Implementado corretamente

### 6. CORS Headers
```javascript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}
```

### 7. Headers da Requisição
```javascript
{
  'Content-Type': 'application/json',
  'x-app-key': '#mmP220411'
}
```

## 📋 Checklist de Verificação

### Função Netlify (`send-whatsapp-message.js`)
- [x] URL do webhook correta
- [x] Header `x-app-key` em minúsculas
- [x] Valor do header correto (`#mmP220411`)
- [x] Normalização de telefone (adiciona DDI 55)
- [x] Escape de mensagem para JSON válido
- [x] Payload no formato correto
- [x] Logs detalhados adicionados
- [x] Tratamento de erros completo

### Formatação de Mensagens (`src/lib/whatsapp.ts`)
- [x] `formatVendaMessage` - usa `\n` para quebras de linha
- [x] `formatAdiantamentoMessage` - usa `\n` para quebras de linha
- [x] `formatParabensMessage` - usa `\n` para quebras de linha
- [x] Todas as mensagens formatadas corretamente

### Envio de Mensagens

#### Vendas (`src/pages/LojaDashboard.tsx`)
- [x] Busca destinatários para tipo 'VENDA'
- [x] Considera `store_id IS NULL` OU `store_id = loja atual`
- [x] Envia em background (não bloqueia UI)
- [x] Logs detalhados adicionados

#### Adiantamentos (`src/pages/SolicitarAdiantamento.tsx`)
- [x] Busca destinatários para tipo 'ADIANTAMENTO'
- [x] Considera `store_id IS NULL` OU `store_id = loja da colaboradora`
- [x] Envia em background (não bloqueia UI)
- [x] Logs detalhados adicionados (5 etapas)

#### Parabéns (`src/pages/LojaDashboard.tsx`)
- [x] Busca destinatários para tipo 'PARABENS'
- [x] Considera apenas `store_id = loja específica` (obrigatório)
- [x] Envia em background (não bloqueia UI)

## 🔍 Pontos de Verificação

### 1. Console do Navegador
Verifique os logs no console ao solicitar adiantamento:
- `📱 [SolicitarAdiantamento] Iniciando processo...`
- `📱 [1/5] Buscando dados da colaboradora...`
- `📱 [2/5] Buscando admin_id da loja...`
- `📱 [3/5] Buscando destinatários WhatsApp...`
- `📱 [4/5] Formatando mensagem...`
- `📱 [5/5] Enviando WhatsApp para X destinatário(s)...`

### 2. Logs da Netlify Function
Verifique os logs no Netlify Dashboard:
- `📱 Enviando mensagem WhatsApp via Webhook n8n para: 55XXXXXXXXXXX`
- `📦 Headers enviados: {...}`
- `📦 Payload completo: {...}`
- `📥 Status da resposta: 200`
- `✅ Mensagem WhatsApp enviada com sucesso`

### 3. Configuração no Banco
Verifique se há destinatários configurados:
```sql
SELECT * FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'ADIANTAMENTO'
AND active = true;
```

## 🐛 Problemas Comuns

### Problema 1: Nenhum destinatário encontrado
**Sintoma**: Log mostra `⚠️ Nenhum destinatário WhatsApp configurado`
**Solução**: 
1. Verificar se há números configurados em "Configurações > Notificações WhatsApp"
2. Verificar se o tipo é 'ADIANTAMENTO'
3. Verificar se `active = true`
4. Verificar se `admin_id` da loja está correto

### Problema 2: Erro 401 Unauthorized
**Sintoma**: Resposta HTTP 401
**Solução**:
1. Verificar se header `x-app-key` está sendo enviado
2. Verificar se o valor é exatamente `#mmP220411`
3. Verificar se o n8n está configurado para aceitar este header

### Problema 3: Erro 400 Bad Request
**Sintoma**: Resposta HTTP 400
**Solução**:
1. Verificar formato do payload
2. Verificar se telefone está normalizado (com DDI 55)
3. Verificar se mensagem está escapada corretamente

### Problema 4: Mensagem não chega
**Sintoma**: Status 200 mas mensagem não chega
**Solução**:
1. Verificar logs do n8n
2. Verificar se o número está correto
3. Verificar se o webhook do n8n está ativo

## 📝 Notas Importantes

1. **Header em minúsculas**: O header deve ser `x-app-key` (não `X-APP-KEY`)
2. **DDI obrigatório**: Telefone deve sempre ter DDI 55
3. **Escape de mensagem**: Mensagem deve ser escapada para JSON válido
4. **Background**: Envio não bloqueia UI (usa Promise sem await)
5. **Logs**: Todos os passos são logados para facilitar debug

## ✅ Status Final

- [x] URL verificada e correta
- [x] Headers verificados e corrigidos
- [x] Formato do payload verificado
- [x] Normalização de telefone verificada
- [x] Escape de mensagem verificado
- [x] Logs detalhados adicionados
- [x] Tratamento de erros completo

