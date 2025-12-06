# 📋 Queries SQL para n8n - Separadas por Node

## 🎯 Use estas queries no workflow n8n

---

## 1️⃣ PostgreSQL - Get Config

**Node no n8n**: `PostgreSQL - Get Config`

**Query**:
```sql
SELECT config_value as uazapi_admin_token
FROM sistemaretiradas.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;
```

**Parâmetros**: Nenhum

---

## 2️⃣ PostgreSQL - Get Token

**Node no n8n**: `PostgreSQL - Get Token`

**Query**:
```sql
SELECT 
  uazapi_token,        -- ← Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;
```

**Parâmetros**:
- `$1` → `{{ $json.customer_id }}`
- `$2` → `{{ $json.site_slug }}`

---

## 3️⃣ PostgreSQL - Save Credentials

**Node no n8n**: `PostgreSQL - Save Credentials`

**Query**:
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

**Parâmetros**:
- `$1` → `{{ $json.customer_id }}`
- `$2` → `{{ $json.site_slug }}`
- `$3` → `{{ $json.uazapi_instance_id }}`
- `$4` → `{{ $json.uazapi_token }}`
- `$5` → `{{ $json.uazapi_phone_number }}`
- `$6` → `{{ $json.uazapi_qr_code }}`
- `$7` → `{{ $json.uazapi_status }}`
- `$8` → `{{ $json.whatsapp_instance_name }}`
- `$9` → `{{ $json.chatwoot_base_url }}`
- `$10` → `{{ $json.chatwoot_account_id }}`
- `$11` → `{{ $json.chatwoot_access_token }}`
- `$12` → `{{ $json.chatwoot_inbox_id }}`

---

## ⚠️ IMPORTANTE

**Todas as queries foram alteradas de**:
- ❌ `elevea.whatsapp_credentials` 
- ❌ `elevea.uazapi_config`

**Para**:
- ✅ `sistemaretiradas.whatsapp_credentials`
- ✅ `sistemaretiradas.uazapi_config`

---

## 🔧 Como Atualizar no n8n

1. Abra o workflow no n8n
2. Para cada node PostgreSQL:
   - Clique no node
   - Vá na aba "Parameters"
   - Cole a query correspondente acima
   - Configure os parâmetros se necessário
   - Salve

---

## ✅ Verificação

Após atualizar, verifique que:
- ✅ Todas as queries usam `sistemaretiradas` (não `elevea`)
- ✅ Os parâmetros estão configurados corretamente
- ✅ O workflow está funcionando sem erros

