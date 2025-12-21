-- =====================================================
-- FORÇAR STATUS CONECTADO PARA MR KITSCH
-- =====================================================
-- Atualiza o status do WhatsApp da MR Kitsch para connected
-- com os dados corretos da instância UazAPI
-- =====================================================

-- Primeiro, mostrar qual é o site_slug atual para verificar
SELECT 
    site_slug,
    uazapi_status,
    uazapi_phone_number,
    uazapi_instance_id,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE 
    site_slug LIKE '%kitsch%'
    OR site_slug LIKE '%mr%'
ORDER BY updated_at DESC
LIMIT 5;

-- Atualizar whatsapp_credentials da MR Kitsch
-- Tenta múltiplas variações do site_slug
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = '2fada9de-3960-4dbb-b47c-be72d00eb1e4',
    uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4', -- Instance Token
    updated_at = NOW()
WHERE 
    site_slug = 'mrkitsch'  -- Formato mais comum (sem underscore)
    OR site_slug = 'mr_kitsch'
    OR site_slug = 'mr-kitsch'
    OR site_slug LIKE '%kitsch%';

-- Verificar se foi atualizado
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
        RAISE NOTICE '✅ Status atualizado para MR Kitsch: connected (559699741090) - % registro(s) atualizado(s)', updated_count;
    ELSE
        RAISE WARNING '⚠️ Nenhum registro encontrado para MR Kitsch. Verifique o site_slug acima.';
    END IF;
END $$;

-- Mostrar resultado após atualização
SELECT 
    site_slug,
    uazapi_status,
    uazapi_phone_number,
    uazapi_instance_id,
    uazapi_token,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE 
    site_slug = 'mrkitsch'
    OR site_slug = 'mr_kitsch'
    OR site_slug LIKE '%kitsch%';

