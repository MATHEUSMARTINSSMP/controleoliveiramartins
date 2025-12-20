-- =====================================================
-- CORREÇÕES WHATSAPP - MR. KITSCH E REGISTROS INVÁLIDOS
-- =====================================================
-- Execute estas queries para corrigir os problemas identificados
-- =====================================================

-- =====================================================
-- CORREÇÃO 1: Atualizar Mr. Kitsch com dados corretos do UazAPI
-- =====================================================
-- Dados esperados do UazAPI:
-- - Status: connected
-- - Número: 559699741090
-- - Instance ID: mr_kitsch_matheusmartinss_icloud_com
-- - Token: (já existe, manter o atual)

UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
AND customer_id = 'matheusmartinss@icloud.com'
RETURNING 
    site_slug, 
    uazapi_status, 
    uazapi_phone_number, 
    uazapi_instance_id,
    updated_at,
    '✅ Mr. Kitsch corrigido!' as resultado;

-- =====================================================
-- VERIFICAÇÃO: Confirmar correção do Mr. Kitsch
-- =====================================================
SELECT 
    'VERIFICAÇÃO: Mr. Kitsch após correção' as verificacao,
    wc.site_slug,
    wc.uazapi_status,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ Status correto'
        ELSE '❌ Status ainda incorreto: ' || wc.uazapi_status
    END as verificacao_status,
    wc.uazapi_phone_number,
    CASE 
        WHEN wc.uazapi_phone_number = '559699741090' THEN '✅ Número correto'
        ELSE '❌ Número incorreto: ' || COALESCE(wc.uazapi_phone_number, 'NULL')
    END as verificacao_numero,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com' THEN '✅ Instance ID correto'
        ELSE '❌ Instance ID incorreto: ' || COALESCE(wc.uazapi_instance_id, 'NULL')
    END as verificacao_instance_id,
    wc.updated_at
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- =====================================================
-- ANÁLISE: Verificar registro inválido antes de corrigir
-- =====================================================
-- O registro tem instance_id "sacada_oh_boy_matheusmartinss_icloud_com"
-- Pode ser um registro duplicado ou migrado incorretamente
SELECT 
    'ANÁLISE: Registro Inválido' as analise,
    wc.*,
    'Este registro parece ser da Sacada mas está sem customer_id e site_slug' as observacao,
    'Verificar se já existe registro correto para sacadaohboy' as recomendacao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE (wc.customer_id IS NULL OR wc.customer_id = '')
   OR (wc.site_slug IS NULL OR wc.site_slug = '');

-- =====================================================
-- VERIFICAÇÃO: Ver se já existe registro correto para Sacada
-- =====================================================
SELECT 
    'VERIFICAÇÃO: Registro Sacada' as verificacao,
    wc.site_slug,
    wc.customer_id,
    wc.uazapi_status,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.site_slug = 'sacadaohboy' AND wc.customer_id = 'matheusmartinss@icloud.com' 
        THEN '✅ Registro correto existe'
        ELSE '⚠️ Verificar registro'
    END as status
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'sacadaohboy'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- =====================================================
-- CORREÇÃO 2A: Se o registro inválido for realmente duplicado/desnecessário
-- =====================================================
-- ATENÇÃO: Execute apenas se confirmar que o registro inválido não é necessário
-- O registro inválido tem instance_id "sacada_oh_boy_matheusmartinss_icloud_com"
-- Se já existe um registro correto para sacadaohboy, este pode ser removido

/*
-- PRIMEIRO: Confirmar que existe registro correto para Sacada
SELECT COUNT(*) as registros_sacada_validos
FROM sistemaretiradas.whatsapp_credentials
WHERE site_slug = 'sacadaohboy' 
AND customer_id = 'matheusmartinss@icloud.com'
AND (customer_id IS NOT NULL AND customer_id != '')
AND (site_slug IS NOT NULL AND site_slug != '');

-- DEPOIS: Se retornar >= 1, pode remover o inválido
DELETE FROM sistemaretiradas.whatsapp_credentials
WHERE (customer_id IS NULL OR customer_id = '')
   OR (site_slug IS NULL OR site_slug = '')
RETURNING 
    customer_id,
    site_slug,
    uazapi_instance_id,
    '✅ Registro inválido removido' as resultado;
*/

-- =====================================================
-- CORREÇÃO 2B: Se o registro inválido precisa ser corrigido (não removido)
-- =====================================================
-- Se o registro inválido tem dados importantes da Sacada, podemos corrigi-lo
-- ATENÇÃO: Execute apenas se não houver registro correto para sacadaohboy

/*
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    customer_id = 'matheusmartinss@icloud.com',
    site_slug = 'sacadaohboy',
    updated_at = NOW()
WHERE (customer_id IS NULL OR customer_id = '')
   OR (site_slug IS NULL OR site_slug = '')
   AND uazapi_instance_id = 'sacada_oh_boy_matheusmartinss_icloud_com'
RETURNING 
    customer_id,
    site_slug,
    uazapi_instance_id,
    '✅ Registro corrigido para Sacada' as resultado;
*/

-- =====================================================
-- RESUMO PÓS-CORREÇÃO
-- =====================================================
SELECT 
    '📊 RESUMO PÓS-CORREÇÃO' as resumo,
    COUNT(*) FILTER (WHERE wc.uazapi_status = 'connected' AND wc.site_slug = 'mrkitsch') as mr_kitsch_conectado,
    COUNT(*) FILTER (WHERE wc.uazapi_status = 'disconnected' AND wc.site_slug = 'mrkitsch') as mr_kitsch_desconectado,
    COUNT(*) FILTER (WHERE (wc.customer_id IS NULL OR wc.customer_id = '') OR (wc.site_slug IS NULL OR wc.site_slug = '')) as registros_invalidos_restantes,
    COUNT(*) FILTER (WHERE wc.uazapi_status = 'connected' AND wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')) as total_lojas_conectadas
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
   OR (wc.customer_id IS NULL OR wc.customer_id = '')
   OR (wc.site_slug IS NULL OR wc.site_slug = '');

