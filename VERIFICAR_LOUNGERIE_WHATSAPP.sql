-- =====================================================
-- VERIFICAÇÃO: STATUS WHATSAPP LOUNGERIE
-- =====================================================
-- Verificar o status atual da Loungerie no banco
-- Comparar com dados da UazAPI:
-- - Token: db5cac34-cd20-44d5-bacd-f1f9d3360789
-- - Número: 559681094159
-- - Status: connected
-- - Instance ID: (gerado a partir do slug + customer_id)
-- =====================================================

-- 1. VERIFICAR DADOS ATUAIS NO BANCO
-- NOTA: whatsapp_credentials não tem coluna 'id', usa chave composta (admin_id, site_slug)
SELECT 
    '📋 DADOS ATUAIS NO BANCO' as info,
    wc.admin_id,
    wc.customer_id,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_token,
    wc.uazapi_instance_id,
    wc.uazapi_phone_number,
    wc.updated_at,
    s.name as store_name,
    s.whatsapp_ativo,
    p.email as admin_email
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
LEFT JOIN sistemaretiradas.profiles p ON p.id = wc.admin_id
WHERE LOWER(wc.site_slug) = 'loungerie'
   OR s.id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%'
   )
ORDER BY wc.updated_at DESC;

-- 2. VERIFICAR TODAS AS LOJAS COM WHATSAPP
SELECT 
    '🔍 TODAS AS LOJAS COM WHATSAPP' as info,
    s.id as store_id,
    s.name as store_name,
    s.site_slug,
    s.whatsapp_ativo,
    wc.uazapi_status,
    wc.uazapi_token,
    wc.uazapi_instance_id,
    wc.uazapi_phone_number,
    wc.updated_at,
    p.email as admin_email
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_credentials wc ON wc.site_slug = s.site_slug AND wc.is_global = false
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.active = true
ORDER BY s.name;

-- 3. VERIFICAR SE HÁ MÚLTIPLOS REGISTROS PARA LOUNGERIE
SELECT 
    '⚠️ VERIFICAR DUPLICATAS' as info,
    COUNT(*) as total_registros,
    COUNT(DISTINCT wc.site_slug) as slugs_diferentes,
    COUNT(DISTINCT wc.admin_id) as admins_diferentes,
    COUNT(DISTINCT wc.uazapi_token) as tokens_diferentes
FROM sistemaretiradas.whatsapp_credentials wc
WHERE LOWER(wc.site_slug) = 'loungerie'
   OR wc.site_slug IN (
       SELECT site_slug FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%'
   );

-- 4. VER TODOS OS REGISTROS DE WHATSAPP_CREDENTIALS PARA LOUNGERIE
SELECT 
    '📦 TODOS OS REGISTROS LOUNGERIE' as info,
    wc.*,
    s.name as store_name,
    s.admin_id as store_admin_id,
    p.email as admin_email
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
LEFT JOIN sistemaretiradas.profiles p ON p.id = wc.admin_id
WHERE LOWER(wc.site_slug) = 'loungerie'
   OR s.id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%'
   )
ORDER BY wc.updated_at DESC;

