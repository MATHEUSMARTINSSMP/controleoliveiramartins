# 📊 Análise do Webhook de Status n8n

## 🔍 Fluxo Atual do Webhook de Status

### 1. **Webhook - Check Status** (`🔍 Webhook - Check Status`)
- **Path:** `api/whatsapp/auth/status`
- **Método:** GET
- **Query Params:** 
  - `siteSlug` (ex: `"elevea"`)
  - `customerId` (ex: `"mathmartins@gmail.com"`)

### 2. **Code - Normalize Status** (`📝 Code - Normalize Status`)
- Normaliza os dados de entrada
- Extrai `siteSlug` e `customerId` dos query params
- Retorna:
  ```json
  {
    "customer_id": "mathmartins@gmail.com",
    "site_slug": "elevea"
  }
  ```

### 3. **PostgreSQL - Get Status** (`🗄️ PostgreSQL - Get Status`)
- **Query:**
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
  LIMIT 1;
  ```
- **Schema:** ✅ `sistemaretiradas` (CORRETO)
- **Retorna:** Dados do banco, incluindo `uazapi_status` atual

### 4. **IF - Has Instance** (`❓ IF - Has Instance`)
- Verifica se existe `uazapi_instance_id`
- **SIM** → Vai para `HTTP - Check UAZAPI Connection`
- **NÃO** → Vai para `Respond - Not Found`

### 5. **HTTP - Check UAZAPI Connection** (`🌐 HTTP - Check UAZAPI Connection`)
- **URL:** `https://elevea.uazapi.com/instance/status`
- **Método:** GET
- **Header:** `token: {{ $json.uazapi_token }}`
- **Retorna:** Status atual da instância na UazAPI

### 6. **Code - Process Status** (`📦 Code - Process Status`)
- Processa a resposta da UazAPI
- Compara status do banco com status da API
- **Lógica:**
  ```javascript
  const state = httpState || dbData.uazapi_status || 'disconnected';
  const connected = state === 'open' || state === 'connected';
  ```
- **Retorna:**
  ```json
  {
    "success": true,
    "ok": true,
    "connected": false,
    "status": "connecting",
    "qrCode": "...",
    "instanceId": "...",
    "phoneNumber": null
  }
  ```

### 7. **Respond - Status** (`📤 Respond - Status`)
- Retorna o JSON processado para o frontend
- **Response Body:** `{{ $json }}`

---

## ❌ Problema Identificado

O workflow **NÃO ATUALIZA O BANCO** quando detecta que a conexão foi estabelecida.

**Cenário:**
1. Frontend faz polling a cada 5 segundos
2. Webhook verifica status na UazAPI → `status: "connected"`
3. Webhook retorna `connected: true` para o frontend
4. **MAS:** O banco continua com `uazapi_status: "connecting"`
5. Próximo polling busca do banco → ainda mostra "connecting"

**Resultado:** Frontend nunca detecta que conectou, mesmo que a UazAPI já tenha conectado.

---

## ✅ Solução (SEM MUDAR ESTRUTURA)

Adicionar um node **UPDATE** após o `📦 Code - Process Status`, mas **ANTES** do `📤 Respond - Status`.

### Fluxo Corrigido:

```
📦 Code - Process Status
  ↓
❓ IF - Status Changed to Connected  ← NOVO
  ├─ SIM → 🗄️ PostgreSQL - Update Status  ← NOVO
  │         ↓
  └─ NÃO → (continuar)
  ↓
📤 Respond - Status
```

### Node: **❓ IF - Status Changed to Connected**

**Condição:**
- `{{ $json.status }}` equals `"connected"`
- **AND** `{{ $('🗄️ PostgreSQL - Get Status').item.json.uazapi_status }}` not equals `"connected"`

**Objetivo:** Só atualizar se o status mudou de "connecting" para "connected"

### Node: **🗄️ PostgreSQL - Update Status**

**Query:**
```sql
UPDATE sistemaretiradas.whatsapp_credentials
SET 
  uazapi_status = $1,
  uazapi_phone_number = CASE 
    WHEN $2 IS NOT NULL AND $2 != '' AND $2 != 'null' THEN $2 
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

**Query Parameters:**
- `$1` → `{{ $json.status }}`
- `$2` → `{{ $json.phoneNumber }}`
- `$3` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.customer_id }}`
- `$4` → `{{ $('🗄️ PostgreSQL - Get Status').item.json.site_slug }}`
- `$5` → `{{ $json.instanceId }}`

---

## 📝 Resumo

**Como funciona atualmente:**
1. Frontend chama GET `/api/whatsapp/auth/status?siteSlug=elevea&customerId=mathmartins@gmail.com`
2. n8n busca credenciais no banco
3. n8n verifica status na UazAPI
4. n8n retorna status para o frontend
5. **❌ NÃO atualiza o banco**

**O que precisa ser adicionado:**
- Node IF para detectar mudança de status
- Node UPDATE para atualizar o banco quando conectar
- **SEM mudar a estrutura existente**, apenas adicionar 2 nodes no meio do fluxo

---

## 🎯 Resultado Esperado

Após a correção:
1. Frontend faz polling
2. Webhook detecta que conectou na UazAPI
3. **✅ Atualiza o banco** para `uazapi_status: "connected"`
4. Próximo polling busca do banco → **✅ Detecta "connected"**
5. Frontend para o polling e mostra status conectado

