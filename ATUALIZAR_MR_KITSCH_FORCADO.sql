-- =====================================================
-- ATUALIZAÇÃO FORÇADA: Mr. Kitsch para CONNECTED
-- =====================================================
-- Esta query FORÇA a atualização para "connected"
-- ignorando qualquer lógica de prevenção de downgrade
-- =====================================================

-- ATUALIZAR DIRETAMENTE NO BANCO
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com';

-- VERIFICAR SE ATUALIZOU
SELECT 
    '✅ ATUALIZAÇÃO FORÇADA APLICADA' as resultado,
    wc.site_slug,
    wc.uazapi_status,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ AGORA ESTÁ CONECTADO'
        ELSE '❌ Ainda desconectado: ' || wc.uazapi_status
    END as status_final,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    wc.updated_at,
    NOW() as agora,
    EXTRACT(EPOCH FROM (NOW() - wc.updated_at)) as segundos_atras
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

