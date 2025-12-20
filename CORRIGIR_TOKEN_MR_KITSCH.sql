-- =====================================================
-- CORRIGIR TOKEN DO MR. KITSCH
-- =====================================================
-- O token no banco está incorreto
-- Token no banco: 4d9e6207-a9ad-46b8-b18b-20c58f72e6a4
-- Token real no UazAPI: 2fada9de-3960-4dbb-b47c-be72d00eb1e4
-- =====================================================

-- Verificar estado atual
SELECT 
    admin_id,
    site_slug,
    uazapi_instance_id,
    uazapi_token,
    uazapi_status,
    uazapi_phone_number,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
AND admin_id = '7391610a-f83b-4727-875f-81299b8bfa68';

-- Atualizar token para o valor correto
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4',
    uazapi_status = 'connected',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND admin_id = '7391610a-f83b-4727-875f-81299b8bfa68';

-- Verificar se foi atualizado
SELECT 
    admin_id,
    site_slug,
    uazapi_instance_id,
    uazapi_token,
    uazapi_status,
    uazapi_phone_number,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'mrkitsch'
AND admin_id = '7391610a-f83b-4727-875f-81299b8bfa68';

