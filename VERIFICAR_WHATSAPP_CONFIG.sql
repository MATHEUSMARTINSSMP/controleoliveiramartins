-- =====================================================
-- VERIFICAR CONFIGURAÇÃO DE WHATSAPP PARA NOTIFICAÇÕES
-- =====================================================

-- 1. Verificar WhatsApp Global
SELECT 
    id,
    customer_id,
    site_slug,
    uazapi_status,
    uazapi_phone_number,
    is_global,
    status,
    display_name,
    created_at
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true
ORDER BY created_at DESC;

-- 2. Verificar WhatsApps de lojas específicas
SELECT 
    wc.id,
    wc.customer_id,
    wc.site_slug,
    wc.uazapi_status,
    wc.uazapi_phone_number,
    wc.is_global,
    wc.status,
    wc.display_name,
    s.name as store_name,
    s.id as store_id
FROM sistemaretiradas.whatsapp_credentials wc
LEFT JOIN sistemaretiradas.stores s ON s.site_slug = wc.site_slug
WHERE wc.is_global = false
ORDER BY s.name, wc.created_at DESC;

-- 3. Verificar configurações de notificação de ponto
SELECT 
    tcnc.id,
    tcnc.store_id,
    s.name as store_name,
    tcnc.notifications_enabled,
    tcnc.use_global_whatsapp,
    tcnc.recipient_phones,
    tcnc.created_at,
    tcnc.updated_at
FROM sistemaretiradas.time_clock_notification_config tcnc
JOIN sistemaretiradas.stores s ON s.id = tcnc.store_id
ORDER BY s.name;

-- 4. Verificar se há WhatsApp Global CONECTADO e ATIVO
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ WhatsApp Global encontrado e conectado'
        ELSE '❌ Nenhum WhatsApp Global conectado'
    END as status_global,
    COUNT(*) as total_global_conectado
FROM sistemaretiradas.whatsapp_credentials
WHERE is_global = true
  AND status = 'active'
  AND uazapi_status = 'connected';

-- 5. Verificar todas as credenciais (para debug)
SELECT 
    id,
    customer_id,
    site_slug,
    uazapi_status,
    is_global,
    status,
    CASE 
        WHEN is_global = true THEN 'Global'
        ELSE 'Loja'
    END as tipo,
    uazapi_phone_number,
    display_name
FROM sistemaretiradas.whatsapp_credentials
ORDER BY is_global DESC, site_slug;

