-- ============================================================================
-- N8N - PostgreSQL - Save WhatsApp Credentials
-- Schema CORRETO: sistemaretiradas (não elevea)
-- ============================================================================

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
  $1,  -- customer_id
  $2,  -- site_slug
  $3,  -- uazapi_instance_id
  $4,  -- uazapi_token
  NULLIF($5, 'null'),  -- uazapi_phone_number
  $6,  -- uazapi_qr_code
  $7,  -- uazapi_status
  $8,  -- whatsapp_instance_name
  $9,  -- chatwoot_base_url
  $10, -- chatwoot_account_id
  $11, -- chatwoot_access_token
  $12, -- chatwoot_inbox_id
  'active'
)
ON CONFLICT (customer_id, site_slug)
DO UPDATE SET
  uazapi_instance_id = EXCLUDED.uazapi_instance_id,
  uazapi_token = EXCLUDED.uazapi_token,
  uazapi_phone_number = NULLIF(EXCLUDED.uazapi_phone_number, 'null'),
  uazapi_qr_code = EXCLUDED.uazapi_qr_code,
  uazapi_status = EXCLUDED.uazapi_status,
  whatsapp_instance_name = EXCLUDED.whatsapp_instance_name,
  chatwoot_base_url = COALESCE(
    NULLIF(EXCLUDED.chatwoot_base_url, ''),
    whatsapp_credentials.chatwoot_base_url,
    'http://31.97.129.229:3000'
  ),
  chatwoot_account_id = COALESCE(
    EXCLUDED.chatwoot_account_id,
    whatsapp_credentials.chatwoot_account_id,
    1
  ),
  chatwoot_access_token = COALESCE(
    NULLIF(EXCLUDED.chatwoot_access_token, ''),
    whatsapp_credentials.chatwoot_access_token,
    'QfZQ83rvSoG8V4FLNqaEfG2Z'
  ),
  chatwoot_inbox_id = COALESCE(
    EXCLUDED.chatwoot_inbox_id,
    whatsapp_credentials.chatwoot_inbox_id
  ),
  updated_at = NOW()
RETURNING *;

-- ============================================================================
-- Query Parameters no N8N (em ordem):
-- ============================================================================
-- [
--   {{ $json.customer_id }},
--   {{ $json.site_slug }},
--   {{ $json.uazapi_instance_id }},
--   {{ $json.uazapi_token }},
--   {{ $json.uazapi_phone_number }},
--   {{ $json.uazapi_qr_code }},
--   {{ $json.uazapi_status }},
--   {{ $json.instance_name }},
--   {{ $json.chatwoot_base_url }},
--   {{ $json.chatwoot_account_id }},
--   {{ $json.chatwoot_access_token }},
--   {{ $json.chatwoot_inbox_id }}
-- ]
