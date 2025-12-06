-- ============================================================================
-- QUERIES SQL CORRETAS PARA O WORKFLOW N8N - PRONTAS PARA COPIAR E COLAR
-- ============================================================================
-- Schema correto: sistemaretiradas (NÃO elevea)
-- ============================================================================

-- ============================================================================
-- 1. POSTGRESQL - GET CONFIG
-- ============================================================================
-- Node: "PostgreSQL - Get Config"
-- Descrição: Busca o admin_token da tabela uazapi_config

SELECT config_value as uazapi_admin_token
FROM sistemaretiradas.uazapi_config
WHERE config_key = 'admin_token'
LIMIT 1;

-- ============================================================================
-- 2. POSTGRESQL - GET TOKEN
-- ============================================================================
-- Node: "PostgreSQL - Get Token"
-- Descrição: Busca credenciais existentes da instância WhatsApp
-- Parâmetros: $1 = customer_id, $2 = site_slug

SELECT 
  uazapi_token,        -- ← Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;

-- ============================================================================
-- 3. POSTGRESQL - SAVE CREDENTIALS
-- ============================================================================
-- Node: "PostgreSQL - Save Credentials"
-- Descrição: Salva ou atualiza credenciais WhatsApp
-- Parâmetros: $1 até $12 (ver abaixo)

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
  -- ✅ CORRIGIDO: Atualizar token apenas se o novo valor não for NULL/vazio
  uazapi_token = CASE 
    WHEN EXCLUDED.uazapi_token IS NOT NULL 
         AND EXCLUDED.uazapi_token != '' 
         AND EXCLUDED.uazapi_token != 'null' 
    THEN EXCLUDED.uazapi_token
    ELSE whatsapp_credentials.uazapi_token  -- Preservar valor existente
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
  -- ✅ CORREÇÃO: Garantir que whatsapp_instance_name seja sempre atualizado se vier um valor não vazio
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

-- ============================================================================
-- PARÂMETROS PARA A QUERY 3 (POSTGRESQL - SAVE CREDENTIALS)
-- ============================================================================
-- Configure no n8n como Query Parameters:
-- 
-- $1  → {{ $json.customer_id }}
-- $2  → {{ $json.site_slug }}
-- $3  → {{ $json.uazapi_instance_id }}
-- $4  → {{ $json.uazapi_token }}
-- $5  → {{ $json.uazapi_phone_number }}
-- $6  → {{ $json.uazapi_qr_code }}
-- $7  → {{ $json.uazapi_status }}
-- $8  → {{ $json.whatsapp_instance_name }}
-- $9  → {{ $json.chatwoot_base_url }}
-- $10 → {{ $json.chatwoot_account_id }}
-- $11 → {{ $json.chatwoot_access_token }}
-- $12 → {{ $json.chatwoot_inbox_id }}

-- ============================================================================
-- MUDANÇAS PRINCIPAIS
-- ============================================================================
-- ❌ ANTES: elevea.whatsapp_credentials
-- ✅ DEPOIS: sistemaretiradas.whatsapp_credentials
--
-- ❌ ANTES: elevea.uazapi_config
-- ✅ DEPOIS: sistemaretiradas.uazapi_config
-- ============================================================================

