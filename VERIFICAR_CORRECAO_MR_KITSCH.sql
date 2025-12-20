-- =====================================================
-- VERIFICAÇÃO: Status atual do Mr. Kitsch após correção
-- =====================================================

-- 1. Verificar status atual no banco
SELECT 
    'STATUS ATUAL NO BANCO' as verificacao,
    wc.site_slug,
    wc.customer_id,
    wc.uazapi_status as status_banco,
    wc.uazapi_phone_number as numero_banco,
    wc.uazapi_instance_id as instance_id_banco,
    wc.updated_at as ultima_atualizacao_banco,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 1) as minutos_atras,
    s.whatsapp_ativo as toggle_ativo_no_banco,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ CONECTADO'
        WHEN wc.uazapi_status = 'disconnected' THEN '❌ DESCONECTADO'
        ELSE '⚠️ ' || COALESCE(wc.uazapi_status, 'NULL')
    END as status_display
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.site_slug = 'mrkitsch'
AND wc.customer_id = 'matheusmartinss@icloud.com';

-- 2. Comparar com dados esperados do UazAPI
SELECT 
    'COMPARAÇÃO COM UAZAPI' as verificacao,
    'Banco de Dados' as origem,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch'

UNION ALL

SELECT 
    'COMPARAÇÃO COM UAZAPI' as verificacao,
    'UazAPI (Esperado)' as origem,
    'connected' as uazapi_status,
    '559699741090' as uazapi_phone_number,
    'mr_kitsch_matheusmartinss_icloud_com' as uazapi_instance_id;

-- 3. Verificar se há alguma inconsistência
SELECT 
    'ANÁLISE DE INCONSISTÊNCIAS' as verificacao,
    CASE 
        WHEN wc.uazapi_status != 'connected' THEN 
            '❌ Status diferente: Banco tem "' || wc.uazapi_status || '" mas UazAPI tem "connected"'
        ELSE '✅ Status correto'
    END as problema_status,
    CASE 
        WHEN wc.uazapi_phone_number IS NULL THEN 
            '❌ Número NULL no banco (deveria ser 559699741090)'
        WHEN wc.uazapi_phone_number != '559699741090' THEN 
            '⚠️ Número diferente: ' || wc.uazapi_phone_number || ' (esperado: 559699741090)'
        ELSE '✅ Número correto'
    END as problema_numero,
    CASE 
        WHEN wc.uazapi_instance_id != 'mr_kitsch_matheusmartinss_icloud_com' THEN 
            '❌ Instance ID diferente: ' || COALESCE(wc.uazapi_instance_id, 'NULL') || ' (esperado: mr_kitsch_matheusmartinss_icloud_com)'
        ELSE '✅ Instance ID correto'
    END as problema_instance_id,
    s.whatsapp_ativo as toggle_ativo,
    CASE 
        WHEN s.whatsapp_ativo = false THEN 
            '⚠️ Toggle "Ativar WhatsApp" está DESLIGADO - isso pode causar problemas de visualização'
        ELSE '✅ Toggle ativo'
    END as problema_toggle
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.site_slug = 'mrkitsch';

-- 4. Forçar atualização (se necessário)
-- DESCOMENTAR E EXECUTAR SE A CORREÇÃO ANTERIOR NÃO FUNCIONOU
/*
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
    '✅ ATUALIZADO FORÇADAMENTE' as resultado;
*/

-- 5. Verificar se o toggle está causando problema
SELECT 
    'VERIFICAÇÃO DO TOGGLE' as verificacao,
    s.name as loja,
    s.whatsapp_ativo,
    wc.uazapi_status,
    CASE 
        WHEN s.whatsapp_ativo = false AND wc.uazapi_status = 'connected' THEN 
            '⚠️ PROBLEMA: Toggle desligado mas status é connected - interface pode não mostrar corretamente'
        WHEN s.whatsapp_ativo = true AND wc.uazapi_status != 'connected' THEN 
            '⚠️ PROBLEMA: Toggle ligado mas status não é connected'
        ELSE '✅ Configuração consistente'
    END as analise
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_credentials wc ON wc.site_slug = s.site_slug
WHERE s.site_slug = 'mrkitsch';

