-- =====================================================
-- TESTES E CONSULTAS WHATSAPP - SUPABASE
-- =====================================================
-- Este arquivo contém queries para verificar e diagnosticar
-- o estado das instâncias WhatsApp no Supabase
-- =====================================================

-- =====================================================
-- 1. VERIFICAR TODAS AS CREDENCIAIS WHATSAPP (PRINCIPAIS)
-- =====================================================
SELECT 
    wc.id,
    wc.admin_id,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    wc.uazapi_token IS NOT NULL as has_token,
    LEFT(wc.uazapi_token, 20) || '...' as token_preview,
    wc.is_global,
    wc.status,
    wc.created_at,
    wc.updated_at,
    p.name as admin_name,
    p.email as admin_email,
    s.name as store_name
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.profiles p ON p.id = wc.admin_id
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
ORDER BY wc.updated_at DESC;

-- =====================================================
-- 2. VERIFICAR STATUS POR LOJA (AGRUPADO)
-- =====================================================
SELECT 
    s.name as loja,
    s.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ Conectado'
        WHEN wc.uazapi_status = 'disconnected' THEN '❌ Desconectado'
        WHEN wc.uazapi_status = 'qr_required' THEN '📱 QR Code Necessário'
        WHEN wc.uazapi_status = 'connecting' THEN '🔄 Conectando'
        WHEN wc.uazapi_status = 'error' THEN '⚠️ Erro'
        ELSE '❓ ' || COALESCE(wc.uazapi_status, 'NULL')
    END as status_display,
    wc.updated_at as ultima_atualizacao
FROM sistemaretiradas.whatsapp_credentials wc
RIGHT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE s.whatsapp_ativo = true
ORDER BY s.name;

-- =====================================================
-- 3. VERIFICAR MR. KITSCH ESPECIFICAMENTE
-- =====================================================
-- Baseado na imagem: Instance: mr_kitsch_matheusmartinss_icloud_com
-- Número: 559699741090
-- Status: connected
-- Token: 2fada9de-3960-4dbb-b47c-be72d00eb1e4
SELECT 
    'MR. KITSCH' as loja,
    wc.site_slug,
    wc.uazapi_status,
    CASE 
        WHEN wc.uazapi_status = 'connected' THEN '✅ Conectado (como esperado)'
        ELSE '⚠️ Status diferente do esperado: ' || COALESCE(wc.uazapi_status, 'NULL')
    END as verificacao_status,
    wc.uazapi_phone_number as numero_supabase,
    '559699741090' as numero_uazapi_esperado,
    CASE 
        WHEN wc.uazapi_phone_number = '559699741090' THEN '✅ Número correto'
        ELSE '⚠️ Número diferente: ' || COALESCE(wc.uazapi_phone_number, 'NULL')
    END as verificacao_numero,
    wc.uazapi_instance_id as instance_id_supabase,
    'mr_kitsch_matheusmartinss_icloud_com' as instance_id_uazapi_esperado,
    CASE 
        WHEN wc.uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com' THEN '✅ Instance ID correto'
        ELSE '⚠️ Instance ID diferente: ' || COALESCE(wc.uazapi_instance_id, 'NULL')
    END as verificacao_instance_id,
    wc.uazapi_token IS NOT NULL as tem_token,
    CASE 
        WHEN wc.uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4' THEN '✅ Token correto'
        WHEN wc.uazapi_token IS NOT NULL THEN '⚠️ Token existe mas diferente'
        ELSE '❌ Token não encontrado'
    END as verificacao_token,
    wc.updated_at,
    EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60 as minutos_desde_ultima_atualizacao
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug = 'mrkitsch';

-- =====================================================
-- 4. VERIFICAR TODAS AS LOJAS COM STATUS "CONNECTED"
-- =====================================================
SELECT 
    s.name as loja,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    LEFT(wc.uazapi_instance_id, 50) as instance_id_preview,
    wc.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 1) as minutos_atras
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.uazapi_status = 'connected'
ORDER BY wc.updated_at DESC;

-- =====================================================
-- 5. VERIFICAR LOJAS COM STATUS "DISCONNECTED" (POTENCIAL PROBLEMA)
-- =====================================================
SELECT 
    s.name as loja,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    wc.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 1) as minutos_atras,
    CASE 
        WHEN wc.uazapi_phone_number IS NOT NULL THEN '⚠️ Tem número mas está desconectado'
        ELSE '❌ Sem número configurado'
    END as observacao
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.uazapi_status = 'disconnected' OR wc.uazapi_status IS NULL
ORDER BY wc.updated_at DESC;

-- =====================================================
-- 6. VERIFICAR NÚMEROS RESERVA (BACKUP)
-- =====================================================
SELECT 
    wa.id,
    s.name as loja,
    wa.store_id,
    wa.phone as numero_reserva,
    wa.uazapi_status,
    wa.uazapi_phone_number,
    wa.uazapi_instance_id,
    wa.is_connected,
    wa.is_backup1,
    wa.is_backup2,
    wa.is_backup3,
    CASE 
        WHEN wa.is_backup1 THEN 'Backup 1'
        WHEN wa.is_backup2 THEN 'Backup 2'
        WHEN wa.is_backup3 THEN 'Backup 3'
        ELSE 'Não definido'
    END as tipo_backup,
    wa.created_at,
    wa.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wa.updated_at))/60, 1) as minutos_atras
FROM sistemaretiradas.whatsapp_accounts wa
LEFT JOIN sistemaretiradas.stores s ON s.id = wa.store_id
ORDER BY wa.updated_at DESC;

-- =====================================================
-- 7. COMPARAR STATUS ENTRE LOJAS (RESUMO)
-- =====================================================
SELECT 
    s.name as loja,
    s.site_slug,
    s.whatsapp_ativo,
    CASE 
        WHEN wc.uazapi_status IS NULL THEN '❌ Sem credenciais'
        WHEN wc.uazapi_status = 'connected' THEN '✅ Conectado'
        WHEN wc.uazapi_status = 'disconnected' THEN '❌ Desconectado'
        WHEN wc.uazapi_status = 'qr_required' THEN '📱 QR Necessário'
        ELSE '⚠️ ' || wc.uazapi_status
    END as status,
    wc.uazapi_phone_number,
    wc.uazapi_instance_id,
    (SELECT COUNT(*) 
     FROM sistemaretiradas.whatsapp_accounts wa 
     WHERE wa.store_id = s.id) as numeros_reserva_configurados,
    wc.updated_at as ultima_verificacao
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_credentials wc ON wc.site_slug = s.site_slug
ORDER BY s.name;

-- =====================================================
-- 8. VERIFICAR INCONSISTÊNCIAS (DIAGNÓSTICO)
-- =====================================================
-- Loja com WhatsApp ativo mas sem credenciais
SELECT 
    '⚠️ Loja com WhatsApp ativo mas sem credenciais' as problema,
    s.name as loja,
    s.site_slug,
    s.whatsapp_ativo
FROM sistemaretiradas.stores s
WHERE s.whatsapp_ativo = true
AND NOT EXISTS (
    SELECT 1 FROM sistemaretiradas.whatsapp_credentials wc 
    WHERE wc.site_slug = s.site_slug
)

UNION ALL

-- Credenciais com status NULL
SELECT 
    '⚠️ Credenciais com status NULL' as problema,
    COALESCE(s.name, wc.site_slug) as loja,
    wc.site_slug,
    wc.uazapi_status
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.uazapi_status IS NULL

UNION ALL

-- Credenciais muito antigas (não atualizadas há mais de 1 hora)
SELECT 
    '⚠️ Status não atualizado há mais de 1 hora' as problema,
    COALESCE(s.name, wc.site_slug) as loja,
    wc.site_slug,
    wc.uazapi_status || ' (atualizado há ' || 
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 0) || ' minutos)' as info
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.updated_at < NOW() - INTERVAL '1 hour'
AND wc.uazapi_status != 'disconnected'

UNION ALL

-- Números reserva sem status
SELECT 
    '⚠️ Número reserva sem status' as problema,
    s.name as loja,
    wa.phone as numero,
    COALESCE(wa.uazapi_status, 'NULL') as status
FROM sistemaretiradas.whatsapp_accounts wa
LEFT JOIN sistemaretiradas.stores s ON s.id = wa.store_id
WHERE wa.uazapi_status IS NULL;

-- =====================================================
-- 9. ATUALIZAR STATUS MANUALMENTE (SE NECESSÁRIO)
-- =====================================================
-- DESCOMENTAR E EXECUTAR APENAS SE NECESSÁRIO
-- ATENÇÃO: Isso sobrescreve o status atual

/*
-- Atualizar Mr. Kitsch para "connected" (se estiver diferente)
UPDATE sistemaretiradas.whatsapp_credentials
SET 
    uazapi_status = 'connected',
    uazapi_phone_number = '559699741090',
    uazapi_instance_id = 'mr_kitsch_matheusmartinss_icloud_com',
    uazapi_token = '2fada9de-3960-4dbb-b47c-be72d00eb1e4',
    updated_at = NOW()
WHERE site_slug = 'mrkitsch'
RETURNING *;
*/

-- =====================================================
-- 10. VERIFICAR ÚLTIMAS ATUALIZAÇÕES (LOGS)
-- =====================================================
SELECT 
    'Credencial Principal' as tipo,
    COALESCE(s.name, wc.site_slug) as loja,
    wc.uazapi_status,
    wc.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 1) as minutos_atras
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug

UNION ALL

SELECT 
    'Número Reserva' as tipo,
    COALESCE(s.name, wa.phone, 'Sem número') as loja,
    wa.uazapi_status,
    wa.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wa.updated_at))/60, 1) as minutos_atras
FROM sistemaretiradas.whatsapp_accounts wa
LEFT JOIN sistemaretiradas.stores s ON s.id = wa.store_id

ORDER BY updated_at DESC
LIMIT 20;

-- =====================================================
-- 11. VERIFICAR ESPECIFICAMENTE MR. KITSCH (DETALHADO)
-- =====================================================
-- Comparar com dados da imagem do UazAPI:
-- Instance: mr_kitsch_matheusmartinss_icloud_com
-- Número: 559699741090
-- Status: connected
-- Token: 2fada9de-3960-4dbb-b47c-be72d00eb1e4

WITH uazapi_data AS (
    SELECT 
        'mr_kitsch_matheusmartinss_icloud_com' as expected_instance_id,
        '559699741090' as expected_phone,
        'connected' as expected_status,
        '2fada9de-3960-4dbb-b47c-be72d00eb1e4' as expected_token
)
SELECT 
    'DADOS UAZAPI (ESPERADO)' as origem,
    u.expected_status as status,
    u.expected_phone as numero,
    u.expected_instance_id as instance_id,
    LEFT(u.expected_token, 20) || '...' as token_preview
FROM uazapi_data u

UNION ALL

SELECT 
    'DADOS SUPABASE (ATUAL)' as origem,
    wc.uazapi_status as status,
    wc.uazapi_phone_number as numero,
    wc.uazapi_instance_id as instance_id,
    LEFT(wc.uazapi_token, 20) || '...' as token_preview
FROM sistemaretiradas.whatsapp_credentials wc
CROSS JOIN uazapi_data u
WHERE wc.site_slug = 'mrkitsch';

-- =====================================================
-- 12. VERIFICAR SE HÁ DIFERENÇAS ENTRE UAZAPI E SUPABASE
-- =====================================================
SELECT 
    wc.site_slug,
    CASE 
        WHEN wc.uazapi_status != 'connected' THEN '❌ Status diferente (Supabase: ' || wc.uazapi_status || ')'
        ELSE '✅ Status correto'
    END as verificacao_status,
    CASE 
        WHEN wc.uazapi_phone_number != '559699741090' AND wc.site_slug = 'mrkitsch' THEN 
            '❌ Número diferente (Supabase: ' || COALESCE(wc.uazapi_phone_number, 'NULL') || ')'
        WHEN wc.site_slug = 'mrkitsch' THEN '✅ Número correto'
        ELSE 'N/A'
    END as verificacao_numero,
    CASE 
        WHEN wc.uazapi_instance_id != 'mr_kitsch_matheusmartinss_icloud_com' AND wc.site_slug = 'mrkitsch' THEN 
            '❌ Instance ID diferente (Supabase: ' || COALESCE(wc.uazapi_instance_id, 'NULL') || ')'
        WHEN wc.site_slug = 'mrkitsch' THEN '✅ Instance ID correto'
        ELSE 'N/A'
    END as verificacao_instance_id,
    wc.updated_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - wc.updated_at))/60, 1) as minutos_atras
FROM sistemaretiradas.whatsapp_credentials wc
WHERE wc.site_slug IN ('mrkitsch', 'sacadaohboy', 'loungerie')
ORDER BY wc.site_slug;

