# 🚀 Como Processar a Fila de WhatsApp AGORA

## ✅ Opções Disponíveis

### Opção 1: Via Script Node.js (Recomendado)

```bash
# Definir variável de ambiente
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"

# Executar script
node PROCESSAR_FILA_AGORA.js
```

Ou use o script simples:

```bash
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"
node PROCESSAR_FILA_AGORA_SIMPLES.js
```

### Opção 2: Via cURL (Terminal)

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY_AQUI" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Opção 3: Via Supabase Dashboard (Mais Fácil)

1. Acesse: **Supabase Dashboard > Edge Functions**
2. Clique em **process-cashback-queue**
3. Clique em **Invoke**
4. Body: `{}`
5. Authorization: `Bearer SUA_SERVICE_ROLE_KEY_AQUI`
6. Clique em **Invoke Function**

## 📋 Verificar Status Antes de Processar

```sql
-- Ver mensagens pendentes
SELECT 
    id,
    transaction_id,
    status,
    attempts,
    error_message,
    created_at
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC;
```

## 📊 Verificar Status Após Processar

```sql
-- Ver resumo de status
SELECT 
    status,
    COUNT(*) as total
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status;
```

## 🔍 Onde Encontrar a SERVICE_ROLE_KEY

1. Acesse **Supabase Dashboard**
2. Vá em **Settings > API**
3. Procure por **service_role** key (secret)
4. Copie a chave (começa com "eyJ...")

## ⚙️ Configurar para Automático (Recomendado)

Para processar automaticamente a cada minuto:

1. Acesse **Supabase Dashboard > Database > Scheduled Jobs**
2. Clique em **Create New Scheduled Job**
3. Configure:
   - **Name:** `processar-fila-whatsapp-cashback`
   - **Schedule:** `* * * * *` (a cada minuto)
   - **Type:** `HTTP Request`
   - **URL:** `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`
   - **Method:** `POST`
   - **Headers:** 
     - Key: `Authorization`
     - Value: `Bearer SUA_SERVICE_ROLE_KEY_AQUI`

## 🎯 O Que a Edge Function Faz

A Edge Function `process-cashback-queue`:

1. ✅ Busca até 10 mensagens pendentes na fila
2. ✅ Para cada mensagem:
   - Busca dados da transação de cashback
   - Busca dados do cliente (nome, telefone)
   - Busca dados da loja
   - Busca configurações de cashback
   - Formata mensagem usando `formatCashbackMessage`
   - Envia WhatsApp via webhook n8n (mesma lógica existente)
   - Atualiza status na fila (SENT, SKIPPED, FAILED, PENDING)
3. ✅ Retorna resumo do processamento

## ⚠️ Importante

- A Edge Function usa **100% do código existente** que já funciona
- Não precisa de extensão HTTP no PostgreSQL
- Processa até 10 mensagens por execução
- Tenta até 3 vezes antes de marcar como FAILED

