# 🔧 Correção: Queries SQL do Workflow n8n

## ⚠️ Problema Identificado

O workflow n8n está usando o schema **`elevea`** quando deveria usar **`sistemaretiradas`**.

---

## 📋 Queries Corretas para o Workflow n8n

### 1. PostgreSQL - Get Config

**❌ INCORRETO (atual):**
```sql
SELECT config_value as uazapi_admin_token
FROM elevea.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;
```

**✅ CORRETO:**
```sql
SELECT config_value as uazapi_admin_token
FROM sistemaretiradas.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;
```

---

### 2. PostgreSQL - Get Token

**❌ INCORRETO (atual):**
```sql
SELECT
  uazapi_admin_token,  -- ADMIN TOKEN (para criar instâncias)
  uazapi_token,        -- Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM elevea.whatsapp_credentials
WHERE customer_id = $1
  AND site_slug = $2
  AND status = 'active'
LIMIT 1;
```

**✅ CORRETO:**
```sql
SELECT
  uazapi_admin_token,  -- ADMIN TOKEN (para criar instâncias)
  uazapi_token,        -- Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1
  AND site_slug = $2
  AND status = 'active'
LIMIT 1;
```

---

### 3. PostgreSQL - Save Credentials

**❌ INCORRETO (atual):**
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
  $1,                              -- customer_id
  $2,                              -- site_slug
  $3,                              -- uazapi_instance_id
  $4,                              -- uazapi_token
  NULLIF($5, 'null'),              -- uazapi_phone_number
  $6,                              -- uazapi_qr_code
  $7,                              -- uazapi_status
  $8,                              -- whatsapp_instance_name
  $9,                              -- chatwoot_base_url
  $10,                             -- chatwoot_account_id
  $11,                             -- chatwoot_access_token
  $12,                             -- chatwoot_inbox_id
  'active'                         -- status
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

**✅ CORRETO:**
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
  $1,                              -- customer_id
  $2,                              -- site_slug
  $3,                              -- uazapi_instance_id
  $4,                              -- uazapi_token
  NULLIF($5, 'null'),              -- uazapi_phone_number
  $6,                              -- uazapi_qr_code
  $7,                              -- uazapi_status
  $8,                              -- whatsapp_instance_name
  $9,                              -- chatwoot_base_url
  $10,                             -- chatwoot_account_id
  $11,                             -- chatwoot_access_token
  $12,                             -- chatwoot_inbox_id
  'active'                         -- status
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

## 🔑 Credenciais Supabase (para referência)

**Project URL:**
```
https://kktsbnrnlnzyofupegjc.supabase.co
```

**Service Role Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s
```

---

## 📝 Resumo das Mudanças Necessárias no n8n

1. **PostgreSQL - Get Config**: Trocar `elevea.uazapi_config` por `sistemaretiradas.uazapi_config`
2. **PostgreSQL - Get Token**: Trocar `elevea.whatsapp_credentials` por `sistemaretiradas.whatsapp_credentials`
3. **PostgreSQL - Save Credentials**: Trocar `elevea.whatsapp_credentials` por `sistemaretiradas.whatsapp_credentials`

---

## ⚠️ Observação Importante

A lógica das queries está **CORRETA**, apenas o schema precisa ser alterado de `elevea` para `sistemaretiradas`.

