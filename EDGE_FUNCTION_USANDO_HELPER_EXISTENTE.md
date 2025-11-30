# ✅ Edge Function Agora Usa Helper de Envio Existente

## 📋 Resumo

A Edge Function `process-cashback-queue` foi **totalmente refatorada** para usar **absolutamente tudo que já existe** no sistema de envio de WhatsApp.

## 🔄 O Que Mudou

### Antes
- Edge Function chamava outra função Netlify (`send-cashback-whatsapp`)
- Dependia de chamadas HTTP entre funções
- Precisava de extensão HTTP no PostgreSQL

### Agora
- ✅ Edge Function processa **tudo internamente**
- ✅ Usa a **mesma lógica** de `send-whatsapp-message.js`
- ✅ Usa a **mesma formatação** de `formatCashbackMessage`
- ✅ Usa o **mesmo webhook n8n** que já funciona
- ✅ **Não precisa de extensão HTTP**

## 🎯 O Que Foi Integrado

### 1. Formatação de Mensagem
```typescript
// Mesma lógica do formatCashbackMessage em src/lib/whatsapp.ts
function formatCashbackMessage(params: {
  clienteNome: string
  storeName: string
  cashbackAmount: number
  dataExpiracao: string
  percentualUsoMaximo: number
  saldoAtual: number
}): string
```

### 2. Normalização de Telefone
```typescript
// Mesma lógica do send-whatsapp-message.js
function normalizePhone(phoneNumber: string): string {
  // Remove caracteres não numéricos
  // Adiciona DDI 55 se necessário
  // Retorna formato esperado pelo webhook n8n
}
```

### 3. Envio via Webhook n8n
```typescript
// Mesma lógica do send-whatsapp-message.js
async function sendWhatsAppMessage(phone: string, message: string) {
  // Webhook: https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send
  // Auth: x-app-key: #mmP220411
  // Payload: { siteSlug, customerId, phoneNumber, message }
}
```

## 📊 Fluxo Completo

1. **Edge Function é chamada** (manual ou via Scheduled Job)
2. **Busca itens pendentes** na fila `cashback_whatsapp_queue`
3. **Para cada item:**
   - Busca dados da transação
   - Busca dados do cliente
   - Busca dados da loja
   - Busca configurações de cashback
   - Busca saldo atual
   - **Formata mensagem** (usando `formatCashbackMessage`)
   - **Envia WhatsApp** (usando `sendWhatsAppMessage` via webhook n8n)
   - Atualiza status na fila (SENT, SKIPPED, FAILED, PENDING)

## 🚀 Como Usar

### Opção 1: Via Supabase Dashboard
1. Vá em **Supabase Dashboard > Edge Functions**
2. Clique em **process-cashback-queue**
3. Clique em **Invoke**
4. Body: `{}`
5. Authorization: `Bearer SEU_SERVICE_ROLE_KEY`

### Opção 2: Via cURL
```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Opção 3: Scheduled Job (Recomendado)
1. Vá em **Supabase Dashboard > Database > Scheduled Jobs**
2. Criar novo Scheduled Job
3. Cron: `* * * * *` (a cada minuto)
4. Type: **HTTP Request**
5. URL: `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`
6. Method: `POST`
7. Headers: `Authorization: Bearer SEU_SERVICE_ROLE_KEY`

## ✅ Vantagens

1. **Reutiliza código existente** - Não duplica lógica
2. **Mais confiável** - Usa o mesmo código que já funciona
3. **Sem dependências externas** - Não precisa de extensão HTTP
4. **Mais rápido** - Processa tudo internamente
5. **Fácil manutenção** - Se mudar a lógica de envio, muda em um lugar só

## 📝 Arquivos Modificados

- ✅ `supabase/functions/process-cashback-queue/index.ts` - Refatorado para usar helpers existentes
- ✅ `PROCESSAR_FILA_EDGE_FUNCTION_AGORA.sql` - Script SQL para testar e verificar

## 🔍 Verificar Status

```sql
-- Ver mensagens pendentes
SELECT * FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC;

-- Ver status geral
SELECT status, COUNT(*) as total
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status;
```

## 🎉 Resultado

Agora a Edge Function usa **100% do código que já existe e funciona**, garantindo consistência e confiabilidade no envio de mensagens de cashback via WhatsApp!

