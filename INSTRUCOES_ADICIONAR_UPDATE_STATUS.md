# 📋 Instruções: Adicionar Update de Status no n8n

## 🎯 Objetivo

Adicionar 2 nodes no workflow de status para **atualizar o banco quando detectar conexão**, sem mudar a estrutura existente.

---

## 📍 Onde Adicionar

**Posição:** Entre `📦 Code - Process Status` e `📤 Respond - Status`

**Fluxo Atual:**
```
📦 Code - Process Status
  ↓
📤 Respond - Status
```

**Fluxo Corrigido:**
```
📦 Code - Process Status
  ↓
❓ IF - Status Changed to Connected  ← ADICIONAR
  ├─ SIM → 🗄️ PostgreSQL - Update Status  ← ADICIONAR
  │         ↓
  └─ NÃO → (continuar)
  ↓
📤 Respond - Status
```

---

## 🔧 Passo 1: Adicionar Node IF

### Node: **❓ IF - Status Changed to Connected**

**Tipo:** `IF` (n8n-nodes-base.if)

**Configuração:**

1. **Condition 1:**
   - **Field 1:** `{{ $json.status }}`
   - **Operation:** `equals`
   - **Value:** `connected`

2. **Condition 2 (AND):**
   - **Field 1:** `{{ $('🗄️ PostgreSQL - Get Status').item.json.uazapi_status }}`
   - **Operation:** `not equals`
   - **Value:** `connected`

**Combinator:** `AND`

**Objetivo:** Só executar o UPDATE se:
- Status atual da API = `"connected"`
- E status no banco ≠ `"connected"` (para evitar updates desnecessários)

---

## 🔧 Passo 2: Adicionar Node UPDATE

### Node: **🗄️ PostgreSQL - Update Status**

**Tipo:** `PostgreSQL` (n8n-nodes-base.postgres)

**Configuração:**

**Operation:** `Execute Query`

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
```
$1 → {{ $json.status }}
$2 → {{ $json.phoneNumber }}
$3 → {{ $('🗄️ PostgreSQL - Get Status').item.json.customer_id }}
$4 → {{ $('🗄️ PostgreSQL - Get Status').item.json.site_slug }}
$5 → {{ $json.instanceId }}
```

**Credential:** Mesma do node `🗄️ PostgreSQL - Get Status` (Postgres account)

**Objetivo:** Atualizar o banco quando detecta conexão:
- Muda `uazapi_status` para `"connected"`
- Atualiza `uazapi_phone_number` se disponível
- Remove o QR Code (`uazapi_qr_code = NULL`)
- Atualiza `updated_at`

---

## 🔗 Conexões

### 1. Conectar `📦 Code - Process Status` → `❓ IF - Status Changed to Connected`
- **Tipo:** `main`
- **Index:** `0`

### 2. Conectar `❓ IF - Status Changed to Connected` (SIM) → `🗄️ PostgreSQL - Update Status`
- **Tipo:** `main`
- **Index:** `0` (branch "true")

### 3. Conectar `❓ IF - Status Changed to Connected` (NÃO) → `📤 Respond - Status`
- **Tipo:** `main`
- **Index:** `1` (branch "false")

### 4. Conectar `🗄️ PostgreSQL - Update Status` → `📤 Respond - Status`
- **Tipo:** `main`
- **Index:** `0`

---

## ✅ Resultado Final

Após adicionar os nodes:

1. **Frontend faz polling** → Chama webhook de status
2. **n8n verifica status** na UazAPI
3. **Se status = "connected" E banco ≠ "connected":**
   - ✅ **Atualiza o banco** para `uazapi_status: "connected"`
   - ✅ **Remove QR Code**
   - ✅ **Atualiza phone number**
4. **Retorna status** para o frontend
5. **Próximo polling** busca do banco → **✅ Detecta "connected"**
6. **Frontend para o polling** e mostra status conectado

---

## 🧪 Teste

1. Conectar WhatsApp no celular
2. Verificar logs do n8n para confirmar que o UPDATE foi executado
3. Verificar no Supabase que `uazapi_status` mudou para `"connected"`
4. Verificar que o frontend detecta a mudança no próximo polling

---

## 📝 Notas Importantes

- ✅ **NÃO muda a estrutura existente**, apenas adiciona 2 nodes
- ✅ **Schema correto:** `sistemaretiradas` (já está correto no `PostgreSQL - Get Status`)
- ✅ **Condição IF evita updates desnecessários** (só atualiza quando muda de "connecting" para "connected")
- ✅ **QR Code é removido** quando conecta (não é mais necessário)

