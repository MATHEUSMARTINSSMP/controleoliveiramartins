-- =====================================================
-- FORÇAR CORREÇÃO DO MR. KITSCH
-- =====================================================
-- Esta query força a atualização ignorando qualquer
-- prevenção de downgrade que possa estar interferindo
-- =====================================================

-- 1. Primeiro, verificar estado atual
SELECT 
    'ESTADO ANTES DA CORREÇÃO' as etapa,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    wc.updated_at,
    s.whatsapp_ativo
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- 2. FORÇAR atualização (ignora prevenção de downgrade)
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com'
RETURNING 
    '✅ ATUALIZADO' as resultado,
    site_slug,
    uazapi_status,
    uazapi_phone_number,
    uazapi_instance_id,
    updated_at;

-- 3. Verificar estado APÓS correção
SELECT 
    'ESTADO APÓS CORREÇÃO' as etapa,
    wc.site_slug,
    wc.uazapi_status,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ CONECTADO'
        ELSE '❌ AINDA DESCONECTADO: ' || wc.uazapi_status
    END as status_verificacao,
    wc.uazapi_phone_number,
    CASE 
        WHEN wc.uazapi_phone_number = '559699741090' THEN '✅ Número correto'
        ELSE '❌ Número incorreto: ' || COALESCE(wc.uazapi_phone_number, 'NULL')
    END as numero_verificacao,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com' THEN '✅ Instance ID correto'
        ELSE '❌ Instance ID incorreto: ' || COALESCE(wc.uazapi_instance_id, 'NULL')
    END as instance_id_verificacao,
    wc.updated_at,
    s.whatsapp_ativo as toggle_ativo,
    CASE 
        WHEN s.whatsapp_ativo = false THEN 
            '⚠️ ATENÇÃO: Toggle "Ativar WhatsApp" está DESLIGADO - ative na interface para ver status conectado'
        ELSE '✅ Toggle ativo'
    END as observacao_toggle
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- 4. ATIVAR O TOGGLE também (se necessário)
-- Descomente se quiser ativar o toggle automaticamente
/*
UPDATE sistemaretiradas.stores
SET whatsapp_ativo = true
WHERE site_slug = 'mrkitsch'
RETURNING 
    name,
    site_slug,
    whatsapp_ativo,
    '✅ TOGGLE ATIVADO' as resultado;
*/

