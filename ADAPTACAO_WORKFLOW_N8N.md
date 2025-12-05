# 🔄 Adaptação do Workflow n8n para Schema sistemaretiradas

## 📋 Mudanças Necessárias no Workflow n8n

O workflow atual usa o schema `elevea`, mas o projeto controleoliveiramartins usa o schema `sistemaretiradas`.

---

## 🔧 **1. MUDANÇAS NOS NODES PostgreSQL**

### **1.1. Node "PostgreSQL - Get Config"**

**ANTES:**
```sql
SELECT config_value as uazapi_admin_token
FROM elevea.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;
```

**DEPOIS:**
```sql
SELECT config_value as uazapi_admin_token
FROM sistemaretiradas.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;
```

---

### **1.2. Node "PostgreSQL - Get Token"**

**ANTES:**
```sql
SELECT 
  uazapi_admin_token,
  uazapi_token,
  uazapi_instance_id,
  uazapi_status
FROM elevea.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;
```

**DEPOIS:**
```sql
SELECT 
  uazapi_token,
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;
```

**NOTA:** Remover `uazapi_admin_token` da query, pois ele vem da tabela `uazapi_config`, não de `whatsapp_credentials`.

---

### **1.3. Node "🗄️ PostgreSQL - Save Credentials"**

**ANTES:**
```sql
INSERT INTO elevea.whatsapp_credentials (
  customer_id,
  site_slug,
  uazapi_instance_id,
  uazapi_token,
  uazapi_phone_number,
  uazapi_qr_code,
  uazapi_status,
  whatsapp_instance_name,
  chatwoot_base_url,
  chatwoot_account_id,
  chatwoot_access_token,
  chatwoot_inbox_id,
  status
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active'
)
ON CONFLICT (customer_id, site_slug)
DO UPDATE SET ...
```

**DEPOIS:**
```sql
INSERT INTO sistemaretiradas.whatsapp_credentials (
  customer_id,
  site_slug,
  uazapi_instance_id,
  uazapi_token,
  uazapi_phone_number,
  uazapi_qr_code,
  uazapi_status,
  whatsapp_instance_name,
  chatwoot_base_url,
  chatwoot_account_id,
  chatwoot_access_token,
  chatwoot_inbox_id,
  status
)
VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active'
)
ON CONFLICT (customer_id, site_slug)
DO UPDATE SET
  uazapi_instance_id = COALESCE(
    NULLIF(EXCLUDED.uazapi_instance_id, ''),
    whatsapp_credentials.uazapi_instance_id
  ),
  uazapi_token = CASE 
    WHEN EXCLUDED.uazapi_token IS NOT NULL 
         AND EXCLUDED.uazapi_token != '' 
         AND EXCLUDED.uazapi_token != 'null' 
    THEN EXCLUDED.uazapi_token
    ELSE whatsapp_credentials.uazapi_token
  END,
  uazapi_phone_number = NULLIF(EXCLUDED.uazapi_phone_number, 'null'),
  uazapi_qr_code = COALESCE(
    NULLIF(EXCLUDED.uazapi_qr_code, ''),
    whatsapp_credentials.uazapi_qr_code
  ),
  uazapi_status = COALESCE(
    NULLIF(EXCLUDED.uazapi_status, ''),
    whatsapp_credentials.uazapi_status
  ),
  whatsapp_instance_name = CASE
    WHEN EXCLUDED.whatsapp_instance_name IS NOT NULL 
         AND EXCLUDED.whatsapp_instance_name != '' 
         AND TRIM(EXCLUDED.whatsapp_instance_name) != '' THEN
      EXCLUDED.whatsapp_instance_name
    ELSE
      whatsapp_credentials.whatsapp_instance_name
  END,
  chatwoot_base_url = COALESCE(
    NULLIF(EXCLUDED.chatwoot_base_url, ''),
    whatsapp_credentials.chatwoot_base_url,
    'http://31.97.129.229:3000'
  ),
  chatwoot_account_id = COALESCE(
    NULLIF(EXCLUDED.chatwoot_account_id::text, ''),
    whatsapp_credentials.chatwoot_account_id::text,
    '1'
  )::integer,
  chatwoot_access_token = COALESCE(
    NULLIF(EXCLUDED.chatwoot_access_token, ''),
    whatsapp_credentials.chatwoot_access_token,
    'QfZQ83rvSoG8V4FLNqaEfG2Z'
  ),
  chatwoot_inbox_id = COALESCE(
    NULLIF(EXCLUDED.chatwoot_inbox_id::text, ''),
    whatsapp_credentials.chatwoot_inbox_id::text
  )::integer,
  updated_at = NOW()
RETURNING *;
```

---

## 📝 **2. RESUMO DAS MUDANÇAS**

### **Schema:**
- ❌ `elevea.whatsapp_credentials` → ✅ `sistemaretiradas.whatsapp_credentials`
- ❌ `elevea.uazapi_config` → ✅ `sistemaretiradas.uazapi_config`

### **Query Replacement:**
Manter o mesmo formato, apenas mudar o schema nas queries SQL.

---

## ✅ **3. CHECKLIST DE ADAPTAÇÃO**

- [ ] Node "PostgreSQL - Get Config": Mudar schema de `elevea` para `sistemaretiradas`
- [ ] Node "PostgreSQL - Get Token": Mudar schema e remover `uazapi_admin_token` da SELECT
- [ ] Node "🗄️ PostgreSQL - Save Credentials": Mudar schema de `elevea` para `sistemaretiradas`
- [ ] Verificar se todas as queries estão usando `sistemaretiradas`
- [ ] Testar workflow após mudanças

---

## 🗄️ **4. ESTRUTURA DAS TABELAS**

### **4.1. whatsapp_credentials**

```sql
CREATE TABLE sistemaretiradas.whatsapp_credentials (
  customer_id VARCHAR(255) NOT NULL,
  site_slug VARCHAR(255) NOT NULL,
  uazapi_instance_id TEXT,
  uazapi_token TEXT,
  uazapi_phone_number TEXT,
  uazapi_qr_code TEXT,
  uazapi_status VARCHAR(50) DEFAULT 'disconnected',
  whatsapp_instance_name VARCHAR(255),
  chatwoot_base_url TEXT,
  chatwoot_account_id INTEGER,
  chatwoot_access_token TEXT,
  chatwoot_inbox_id INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  instance_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, site_slug)
);
```

### **4.2. uazapi_config**

```sql
CREATE TABLE sistemaretiradas.uazapi_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(255) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 **5. CONFIGURAÇÃO INICIAL**

Após criar as tabelas, inserir o admin token:

```sql
INSERT INTO sistemaretiradas.uazapi_config (config_key, config_value, description)
VALUES ('admin_token', 'SEU_ADMIN_TOKEN_AQUI', 'Token de administrador da UazAPI')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

---

## 📌 **6. NOTAS IMPORTANTES**

1. **Schema:** Todas as queries devem usar `sistemaretiradas`, não `elevea`
2. **RLS:** As políticas RLS estão configuradas para permitir acesso apenas a admins
3. **Admin Token:** Deve ser inserido manualmente na tabela `uazapi_config` após criar as tabelas
4. **Credenciais Chatwoot:** Podem ser fixas no workflow ou dinâmicas (o workflow atual usa fixas)

---

**Data:** 2025-12-05  
**Versão:** 1.0.0

