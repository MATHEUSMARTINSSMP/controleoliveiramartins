-- =====================================================
-- CORREÇÃO FINAL: Token do Mr. Kitsch
-- =====================================================
-- Token no banco: 4d9e6207-a9ad-46b8-b18b-20c58f72e6a4 (INCORRETO)
-- Token correto no UazAPI: 2fada9de-3960-4dbb-b47c-be72d00eb1e4
-- =====================================================

-- 1. Verificar estado atual ANTES da correção
SELECT 
    '🔍 ANTES DA CORREÇÃO:' as info,
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
AND customer_id = 'matheusmartinss@icloud.com';

-- 2. ATUALIZAR TOKEN PARA O VALOR CORRETO
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4', -- Token correto do UazAPI
    uazapi_status = 'connected',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com'
AND admin_id = '7391610a-f83b-4727-875f-81299b8bfa68';

-- 3. Verificar estado DEPOIS da correção
SELECT 
    '✅ DEPOIS DA CORREÇÃO:' as info,
    admin_id,
    customer_id,
    site_slug,
    uazapi_instance_id,
    uazapi_token as token_completo,
    CASE 
        WHEN uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4' THEN '✅ TOKEN CORRETO'
        ELSE '❌ TOKEN AINDA ESTÁ ERRADO: ' || LEFT(uazapi_token, 30) || '...'
    END as status_token,
    uazapi_status,
    uazapi_phone_number,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com';

-- =====================================================
-- NOTA: Após executar esta correção:
-- 1. O N8N vai buscar o token correto do banco
-- 2. O N8N vai usar o token correto para verificar na UazAPI
-- 3. A UazAPI vai retornar "connected" corretamente
-- 4. O sistema vai reconhecer o Mr. Kitsch como conectado
-- =====================================================

