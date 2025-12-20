-- =====================================================
-- INVESTIGAR: Por que o token está errado no banco?
-- =====================================================
-- O N8N busca por: customer_id + site_slug
-- Mas pode haver múltiplos registros ou conflito de chaves
-- =====================================================

-- 1. Verificar TODOS os registros de mrkitsch (pode haver múltiplos)
SELECT 
    '🔍 TODOS OS REGISTROS MRKITSCH:' as info,
    admin_id,
    customer_id,
    site_slug,
    uazapi_instance_id,
    LEFT(uazapi_token, 20) || '...' as token_preview,
    uazapi_status,
    uazapi_phone_number,
    created_at,
    updated_at,
    CASE 
        WHEN uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4' THEN '✅ TOKEN CORRETO'
        WHEN uazapi_token = '4d9e6207-a9ad-46b8-b18b-20c58f72e6a4' THEN '❌ TOKEN ANTIGO (INCORRETO)'
        ELSE '⚠️ TOKEN DIFERENTE'
    END as status_token
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
ORDER BY updated_at DESC;

-- 2. Verificar qual registro o N8N está buscando
-- N8N busca por: customer_id='matheusmartinss@icloud.com' AND site_slug='mrkitsch'
SELECT 
    '🔍 REGISTRO QUE O N8N BUSCA:' as info,
    admin_id,
    customer_id,
    site_slug,
    uazapi_instance_id,
    uazapi_token,
    uazapi_status,
    uazapi_phone_number,
    updated_at,
    CASE 
        WHEN uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4' THEN '✅ TOKEN CORRETO'
        WHEN uazapi_token = '4d9e6207-a9ad-46b8-b18b-20c58f72e6a4' THEN '❌ TOKEN ANTIGO (INCORRETO)'
        ELSE '⚠️ TOKEN DIFERENTE: ' || uazapi_token
    END as status_token
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com';

-- 3. Verificar se há registros com admin_id diferente (pode causar confusão)
SELECT 
    '🔍 REGISTROS POR ADMIN_ID:' as info,
    admin_id,
    COUNT(*) as total_registros,
    STRING_AGG(DISTINCT customer_id, ', ') as customer_ids,
    STRING_AGG(DISTINCT LEFT(uazapi_token, 20) || '...', ', ') as tokens_preview
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
GROUP BY admin_id;

-- 4. Verificar se há conflito de chave única (customer_id, site_slug)
-- Se houver múltiplos registros com mesma chave, o ON CONFLICT pode estar atualizando o errado
SELECT 
    '🔍 VERIFICAR CONFLITOS DE CHAVE:' as info,
    customer_id,
    site_slug,
    COUNT(*) as total_registros,
    STRING_AGG(admin_id::text, ', ') as admin_ids,
    STRING_AGG(LEFT(uazapi_token, 20) || '...', ', ') as tokens_preview
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
GROUP BY customer_id, site_slug
HAVING COUNT(*) > 1;

-- 5. Verificar histórico: quando o token foi atualizado pela última vez
SELECT 
    '📅 HISTÓRICO DE ATUALIZAÇÕES:' as info,
    admin_id,
    customer_id,
    site_slug,
    LEFT(uazapi_token, 20) || '...' as token_preview,
    uazapi_status,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 as horas_atras
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
ORDER BY updated_at DESC;

-- 6. Verificar se o token no banco corresponde ao instance_id
-- O instance_id deve ser: mr_kitsch_matheusmartinss_icloud_com
SELECT 
    '🆔 VERIFICAR INSTANCE_ID:' as info,
    admin_id,
    customer_id,
    site_slug,
    uazapi_instance_id,
    CASE 
        WHEN uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com' THEN '✅ INSTANCE_ID CORRETO'
        ELSE '❌ INSTANCE_ID DIFERENTE: ' || uazapi_instance_id
    END as status_instance_id,
    LEFT(uazapi_token, 20) || '...' as token_preview
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch';

