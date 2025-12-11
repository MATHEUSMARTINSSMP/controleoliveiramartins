-- =====================================================
-- VERIFICAR WHATSAPP GLOBAL NO BANCO DE DADOS
-- =====================================================

-- 1. Verificar WhatsApp Global (mesma query do componente)
SELECT 
    id,
    customer_id,
    site_slug,
    display_name,
    uazapi_status,
    uazapi_phone_number,
    is_global,
    status,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true;

-- 2. Verificar se há múltiplos registros globais
SELECT 
    COUNT(*) as total_global,
    COUNT(CASE WHEN uazapi_status = 'connected' THEN 1 END) as total_conectado,
    COUNT(CASE WHEN uazapi_status != 'connected' THEN 1 END) as total_nao_conectado
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true;

-- 3. Verificar todos os valores possíveis de uazapi_status
SELECT DISTINCT 
    uazapi_status,
    COUNT(*) as quantidade
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true
GROUP BY uazapi_status;

-- 4. Verificar WhatsApp Global com detalhes completos
SELECT 
    'WhatsApp Global' as tipo,
    id,
    customer_id,
    site_slug,
    display_name,
    uazapi_status,
    uazapi_phone_number,
    is_global,
    status,
    CASE 
        WHEN uazapi_status = 'connected' THEN '✅ CONECTADO'
        WHEN uazapi_status IS NULL THEN '⚠️ STATUS NULL'
        ELSE '❌ ' || uazapi_status
    END as status_display,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true
ORDER BY updated_at DESC;

