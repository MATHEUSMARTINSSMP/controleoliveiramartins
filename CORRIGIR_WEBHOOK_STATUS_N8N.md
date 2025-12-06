# 🔧 Correção do Webhook de Status do WhatsApp no n8n

## ❌ Problemas Identificados:

1. **Schema errado**: Query usando `elevea.whatsapp_credentials` em vez de `sistemaretiradas.whatsapp_credentials`
2. **Não atualiza banco**: Quando detecta que está conectado, não atualiza o banco de dados
3. **Falta sincronização**: Precisa atualizar o status no banco quando a conexão é estabelecida

## ✅ Correções Necessárias:

### 1. Corrigir Schema na Query:

**❌ ERRADO:**
```sql
SELECT 
  customer_id,
  site_slug,
  uazapi_instance_id,
  uazapi_token,
  uazapi_status,
  uazapi_qr_code,
  uazapi_phone_number,
  chatwoot_inbox_id,
  connected_at,
  last_sync_at
FROM elevea.whatsapp_credentials
WHERE customer_id = $1 AND site_slug = $2 AND status = 'active'
LIMIT 1
```

**✅ CORRETO:**
```sql
SELECT 
  customer_id,
  site_slug,
  uazapi_instance_id,
  uazapi_token,
  uazapi_status,
  uazapi_qr_code,
  uazapi_phone_number,
  chatwoot_inbox_id,
  created_at,
  updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 AND site_slug = $2 AND status = 'active'
LIMIT 1
```

### 2. Adicionar Node para Atualizar Banco quando Conectar:

Após o node "📦 Code - Process Status", adicionar:

**Node: "🗄️ PostgreSQL - Update Status if Connected"**

**SQL Query:**
```sql
UPDATE sistemaretiradas.whatsapp_credentials
SET 
  uazapi_status = $1,
  uazapi_phone_number = $2,
  uazapi_qr_code = NULL,  -- Limpar QR Code quando conectado
  updated_at = NOW()
WHERE 
  customer_id = $3 
  AND site_slug = $4
  AND uazapi_instance_id = $5
RETURNING *;
```

**Query Parameters:**
- `$1` → `{{ $json.status }}` (deve ser 'connected' se conectou)
- `$2` → `{{ $json.phoneNumber }}`
- `$3` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.customer_id }}`
- `$4` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.site_slug }}`
- `$5` → `{{ $json.instanceId }}`

**Condição IF antes de atualizar:**
- Adicionar node IF antes do UPDATE
- Condição: `{{ $json.status }} === 'connected'` AND `{{ $('🗄️ PostgreSQL - Get Status').item.json.uazapi_status }} !== 'connected'`

### 3. Estrutura Corrigida do Workflow:

```
🔍 Webhook - Check Status
  ↓
📝 Code - Normalize Status
  ↓
🗄️ PostgreSQL - Get Status (SCHEMA CORRIGIDO: sistemaretiradas)
  ↓
❓ IF - Has Instance
  ├─ SIM → 🌐 HTTP - Check UAZAPI Connection
  │         ↓
  │       📦 Code - Process Status
  │         ↓
  │       ❓ IF - Status Changed to Connected
  │         ├─ SIM → 🗄️ PostgreSQL - Update Status (ATUALIZAR BANCO)
  │         │         ↓
  │         └─ NÃO → (continuar)
  │         ↓
  │       📤 Respond - Status
  │
  └─ NÃO → 📤 Respond - Not Found
```

### 4. Node "❓ IF - Status Changed to Connected":

**Condição:**
```
{{ $json.status }} === 'connected' 
AND 
{{ $('🗄️ PostgreSQL - Get Status').item.json.uazapi_status }} !== 'connected'
```

### 5. Node "🗄️ PostgreSQL - Update Status":

**SQL:**
```sql
UPDATE sistemaretiradas.whatsapp_credentials
SET 
  uazapi_status = $1,
  uazapi_phone_number = CASE 
    WHEN $2 IS NOT NULL AND $2 != '' THEN $2 
    ELSE uazapi_phone_number 
  END,
  uazapi_qr_code = NULL,
  updated_at = NOW()
WHERE 
  customer_id = $3 
  AND site_slug = $4
  AND uazapi_instance_id = $5
RETURNING *;
```

**Parâmetros:**
- `$1` → `{{ $json.status }}`
- `$2` → `{{ $json.phoneNumber }}`
- `$3` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.customer_id }}`
- `$4` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.site_slug }}`
- `$5` → `{{ $json.instanceId }}`

## 📝 Resumo das Mudanças:

1. ✅ Trocar `elevea.whatsapp_credentials` → `sistemaretiradas.whatsapp_credentials`
2. ✅ Adicionar node IF para verificar se status mudou para "connected"
3. ✅ Adicionar node UPDATE para atualizar o banco quando conecta
4. ✅ Limpar QR Code quando status muda para "connected"

