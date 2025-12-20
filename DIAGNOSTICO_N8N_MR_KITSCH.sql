-- =====================================================
-- DIAGNÓSTICO: Por que N8N retorna disconnected para Mr. Kitsch
-- =====================================================
-- O N8N recebe: siteSlug='mrkitsch', customerId='matheusmartinss@icloud.com'
-- E retorna: uazapi_status='pending', uazapi_token=null
-- =====================================================

-- 1. Verificar o que o N8N está buscando
SELECT 
    '🔍 O QUE O N8N ESTÁ BUSCANDO:' as info,
    'siteSlug' as campo,
    'mrkitsch' as valor_recebido
UNION ALL
SELECT 
    '🔍 O QUE O N8N ESTÁ BUSCANDO:' as info,
    'customerId' as campo,
    'matheusmartinss@icloud.com' as valor_recebido;

-- 2. Verificar se existe registro com esses parâmetros
SELECT 
    '📋 REGISTRO NO BANCO:' as info,
    wc.admin_id,
    wc.site_slug,
    wc.customer_id,
    wc.uazapi_instance_id,
    wc.uazapi_token,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.updated_at,
    CASE 
        WHEN wc.uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4' THEN '✅ TOKEN CORRETO'
        WHEN wc.uazapi_token = '4d9e6207-a9ad-46b8-b18b-20c58f72e6a4' THEN '❌ TOKEN ANTIGO (INCORRETO)'
        ELSE '⚠️ TOKEN DIFERENTE: ' || wc.uazapi_token
    END as status_token
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- 3. Verificar se há múltiplos registros (pode causar confusão)
SELECT 
    '🔢 TOTAL DE REGISTROS PARA MRKITSCH:' as info,
    COUNT(*) as total,
    COUNT(DISTINCT customer_id) as customer_ids_diferentes,
    COUNT(DISTINCT admin_id) as admin_ids_diferentes
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch';

-- 4. Listar TODOS os registros de mrkitsch (para ver se há duplicatas)
SELECT 
    '📋 TODOS OS REGISTROS MRKITSCH:' as info,
    admin_id,
    customer_id,
    site_slug,
    uazapi_instance_id,
    LEFT(uazapi_token, 20) || '...' as token_preview,
    uazapi_status,
    uazapi_phone_number,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
ORDER BY updated_at DESC;

-- 5. Verificar se o token no banco corresponde ao token no UazAPI
SELECT 
    '🔑 COMPARAÇÃO DE TOKENS:' as info,
    'Token no banco' as origem,
    wc.uazapi_token as token
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com'
UNION ALL
SELECT 
    '🔑 COMPARAÇÃO DE TOKENS:' as info,
    'Token no UazAPI (real)' as origem,
    '2fada9de-3960-4dbb-b47c-be72d00eb1e4' as token;

-- 6. Verificar se o instance_id está correto
SELECT 
    '🆔 INSTANCE ID:' as info,
    'No banco' as origem,
    wc.uazapi_instance_id as instance_id
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com'
UNION ALL
SELECT 
    '🆔 INSTANCE ID:' as info,
    'No UazAPI (esperado)' as origem,
    'mr_kitsch_matheusmartinss_icloud_com' as instance_id;

