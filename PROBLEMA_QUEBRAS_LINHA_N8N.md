# Problema: Quebras de Linha em JSON no n8n

## Contexto

Estamos tentando enviar mensagens WhatsApp via webhook n8n → UAZAPI. O fluxo é:

1. **Frontend React** → formata mensagem e envia para Netlify Function
2. **Netlify Function** → recebe `{ phone, message }`, faz `JSON.stringify()` e envia para webhook n8n
3. **Webhook n8n** → recebe `{ siteSlug, customerId, phoneNumber, message }`
4. **Node n8n "Code - Prepare Send Data"** → prepara dados para API UAZAPI
5. **Node n8n "HTTP - Send via UAZAPI1"** → envia para UAZAPI usando:
   ```json
   {
     "number": "{{ $json.phone_number }}",
     "text": "{{ $json.message }}"
   }
   ```

## Problema

Quando a mensagem contém quebras de linha (`\n`), o node "HTTP - Send via UAZAPI1" falha com o erro:

```
JSON parameter needs to be valid JSON
```

### O que funciona:
- Mensagem em **uma linha única** (sem `\n`) ✅
  ```json
  {
    "number": "5596981032928",
    "text": "🛒 *Nova Venda Lançada* *Colaboradora:* Matheus *Loja:* Mr. Kitsch *Valor:* R$ 10,00 Sistema EleveaOne 📊"
  }
  ```

### O que não funciona:
- Mensagem com quebras de linha (`\n`) ❌
  ```json
  {
    "number": "5596981032928",
    "text": "🛒 *Nova Venda Lançada*\n\n*Colaboradora:* Matheus\n*Loja:* Mr. Kitsch\n..."
  }
  ```

## Detalhes Técnicos

### Fluxo de Dados:

1. **JavaScript (Frontend):**
   ```javascript
   const message = `🛒 *Nova Venda Lançada*\n\n*Colaboradora:* Matheus\n...`;
   // message contém: "🛒 *Nova Venda Lançada*\n\n*Colaboradora:* Matheus\n..."
   ```

2. **JSON.stringify() na Netlify Function:**
   ```javascript
   const payload = { siteSlug, customerId, phoneNumber, message };
   body: JSON.stringify(payload)
   // JSON válido enviado: { "message": "🛒 *Nova Venda Lançada*\\n\\n..." }
   // (\\n é escapado corretamente no JSON)
   ```

3. **n8n recebe o JSON:**
   - O webhook n8n recebe e processa corretamente
   - O campo `message` chega com `\n` como caracteres de escape

4. **Node "Code - Prepare Send Data" no n8n:**
   - Pega `message` do input
   - Prepara para o node HTTP
   - Passa `message` adiante

5. **Node "HTTP - Send via UAZAPI1" no n8n:**
   - Usa expressão `{{ $json.message }}` no campo JSON
   - **PROBLEMA:** Quando substitui `{{ $json.message }}`, os `\n` não são tratados corretamente
   - O JSON resultante fica inválido

### Erro Específico:

O erro ocorre em:
```
HttpRequestV3.node.ts:430:15
NodeOperationError: JSON parameter needs to be valid JSON
```

Isso indica que quando o n8n tenta construir o JSON body usando `{{ $json.message }}`, o resultado não é um JSON válido porque os caracteres `\n` dentro da string não estão sendo escapados corretamente.

## Tentativas Realizadas

1. ✅ **Uma linha única** - Funciona, mas a mensagem fica difícil de ler
2. ❌ **`\n` direto** - Não funciona, quebra o JSON no n8n
3. ✅ **Separadores visuais (`|` ou `•`)** - Funciona, mas não é ideal

## Pergunta para o Gemini

**Como fazer quebras de linha funcionarem em strings JSON quando usando expressões `{{ $json.field }}` no n8n?**

Especificamente:
- Como escapar corretamente `\n` para que o n8n construa um JSON válido?
- Existe uma função n8n para escapar strings JSON?
- Como processar o campo `message` no node "Code - Prepare Send Data" para que as quebras de linha funcionem no JSON final?

## Arquivos Relevantes

- `src/lib/whatsapp.ts` - Função que formata a mensagem
- `netlify/functions/send-whatsapp-message.js` - Função que envia para webhook n8n
- Workflow n8n: Node "HTTP - Send via UAZAPI1" usando `{{ $json.message }}` no JSON body

## Formato Desejado

Queremos que a mensagem seja formatada assim (com quebras de linha reais no WhatsApp):

```
🛒 *Nova Venda Lançada*

*Colaboradora:* Matheus
*Loja:* Mr. Kitsch
*Valor:* R$ 10,00
*Quantidade de Peças:* 2
*Data:* 23/11/2025, 02:20

*Observações:*
venda realizada como teste

Sistema EleveaOne 📊
```

Mas isso precisa funcionar no JSON do n8n sem quebrar a validação do JSON.

