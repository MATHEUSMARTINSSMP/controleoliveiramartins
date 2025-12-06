-- ============================================================================
-- QUERY CORRIGIDA: PostgreSQL - Get Token
-- ============================================================================
-- Node: "PostgreSQL - Get Token"
-- 
-- ❌ ERRO ORIGINAL:
--   column "uazapi_admin_token" does not exist
--
-- ✅ CORREÇÃO:
--   Remover uazapi_admin_token da query. Essa coluna NÃO EXISTE na tabela
--   whatsapp_credentials. O admin_token já vem do node anterior (Get Config).
-- ============================================================================

SELECT 
  uazapi_token,        -- Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;

-- Parâmetros:
-- $1 → {{ $json.customer_id }}
-- $2 → {{ $json.site_slug }}

-- ============================================================================
-- ESTRUTURA DA TABELA whatsapp_credentials
-- ============================================================================
-- Colunas disponíveis:
--   ✅ customer_id
--   ✅ site_slug
--   ✅ uazapi_instance_id
--   ✅ uazapi_token (NÃO é admin_token, é token da instância)
--   ✅ uazapi_phone_number
--   ✅ uazapi_qr_code
--   ✅ uazapi_status
--   ✅ whatsapp_instance_name
--   ✅ chatwoot_* (várias colunas)
--   ✅ status
--   ✅ instance_metadata
--
-- ❌ NÃO TEM:
--   - uazapi_admin_token (esse fica em uazapi_config)
-- ============================================================================

