-- =====================================================
-- VERIFICAÇÃO COMPLETA: ENVIOS WHATSAPP LOJA LOUNGERIE
-- =====================================================
-- Esta query verifica TODOS os tipos de envio de mensagens WhatsApp
-- para a loja "Loungerie", incluindo:
-- - Campanhas (whatsapp_message_queue com campaign_id)
-- - Notificações de ponto (whatsapp_message_queue com message_type TIME_CLOCK_ALERT)
-- - Cashback (cashback_whatsapp_queue)
-- - Outros tipos (whatsapp_message_queue com outros message_type)
-- =====================================================

-- =====================================================
-- 1. IDENTIFICAR LOJA LOUNGERIE
-- =====================================================
SELECT 
    '📍 LOJA LOUNGERIE' as info,
    s.id as store_id,
    s.name as store_name,
    s.site_slug,
    s.whatsapp_ativo,
    s.created_at
FROM sistemaretiradas.stores s
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
ORDER BY s.name;

-- =====================================================
-- 2. ENVIOS DA FILA UNIFICADA (whatsapp_message_queue)
-- =====================================================
-- Esta tabela contém: campanhas, notificações, ponto, etc.
SELECT 
    '📋 FILA UNIFICADA (whatsapp_message_queue)' as fonte,
    q.id,
    q.phone,
    LEFT(q.message, 50) as message_preview,
    q.store_id,
    s.name as store_name,
    q.message_type,
    q.priority,
    q.status,
    q.campaign_id,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        WHEN q.message_type = 'OTHER' THEN 'OUTRO'
        ELSE 'DESCONHECIDO'
    END as tipo_envio,
    q.whatsapp_account_id,
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Número Principal/Global'
        ELSE 'Número Reserva'
    END as tipo_numero,
    q.scheduled_for,
    q.sent_at,
    q.error_message,
    q.created_at
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR q.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
ORDER BY q.created_at DESC
LIMIT 1000;

-- =====================================================
-- 3. RESUMO POR TIPO DE ENVIO (FILA UNIFICADA)
-- =====================================================
SELECT 
    '📊 RESUMO POR TIPO' as info,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        WHEN q.message_type = 'OTHER' THEN 'OUTRO'
        ELSE q.message_type
    END as tipo_envio,
    q.status,
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Principal/Global'
        ELSE 'Reserva'
    END as tipo_numero,
    COUNT(*) as total,
    COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
    COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhas,
    COUNT(CASE WHEN q.status = 'PENDING' THEN 1 END) as pendentes,
    COUNT(CASE WHEN q.status = 'SCHEDULED' THEN 1 END) as agendadas,
    MIN(q.created_at) as primeira_envio,
    MAX(q.created_at) as ultima_envio,
    MAX(q.sent_at) as ultima_enviada_com_sucesso
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR q.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
GROUP BY 
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        WHEN q.message_type = 'OTHER' THEN 'OUTRO'
        ELSE q.message_type
    END,
    q.status,
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Principal/Global'
        ELSE 'Reserva'
    END
ORDER BY tipo_envio, status;

-- =====================================================
-- 4. ENVIOS DE CASHBACK (cashback_whatsapp_queue)
-- =====================================================
-- Se existir tabela específica de cashback
SELECT 
    '💰 CASHBACK (cashback_whatsapp_queue)' as fonte,
    cq.id,
    cq.phone,
    LEFT(cq.message, 50) as message_preview,
    cq.store_id,
    s.name as store_name,
    cq.status,
    cq.sent_at,
    cq.error_message,
    cq.created_at
FROM sistemaretiradas.cashback_whatsapp_queue cq
LEFT JOIN sistemaretiradas.stores s ON s.id = cq.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR cq.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
ORDER BY cq.created_at DESC
LIMIT 500;

-- =====================================================
-- 5. RESUMO CASHBACK (se tabela existir)
-- =====================================================
SELECT 
    '📊 RESUMO CASHBACK' as info,
    cq.status,
    COUNT(*) as total,
    COUNT(CASE WHEN cq.status = 'SENT' THEN 1 END) as enviadas,
    COUNT(CASE WHEN cq.status = 'FAILED' THEN 1 END) as falhas,
    COUNT(CASE WHEN cq.status = 'PENDING' THEN 1 END) as pendentes,
    MIN(cq.created_at) as primeira_envio,
    MAX(cq.created_at) as ultima_envio,
    MAX(cq.sent_at) as ultima_enviada_com_sucesso
FROM sistemaretiradas.cashback_whatsapp_queue cq
LEFT JOIN sistemaretiradas.stores s ON s.id = cq.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR cq.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
GROUP BY cq.status
ORDER BY cq.status;

-- =====================================================
-- 6. CAMPANHAS CRIADAS (whatsapp_campaigns)
-- =====================================================
SELECT 
    '📢 CAMPANHAS CRIADAS' as info,
    c.id as campaign_id,
    c.name as campaign_name,
    c.store_id,
    s.name as store_name,
    c.status as campaign_status,
    c.total_recipients,
    c.sent_count,
    c.failed_count,
    ROUND(c.sent_count::numeric / NULLIF(c.total_recipients, 0) * 100, 2) as percentual_enviado,
    c.scheduled_start_at,
    c.created_at,
    c.updated_at
FROM sistemaretiradas.whatsapp_campaigns c
LEFT JOIN sistemaretiradas.stores s ON s.id = c.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR c.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
ORDER BY c.created_at DESC;

-- =====================================================
-- 7. VERIFICAR USO DE NÚMEROS RESERVA vs PRINCIPAL
-- =====================================================
-- Esta query identifica se mensagens estão usando números reserva indevidamente
SELECT 
    '🔍 ANÁLISE: NÚMEROS RESERVA vs PRINCIPAL' as info,
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Número Principal/Global'
        ELSE 'Número Reserva'
    END as tipo_numero,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        ELSE q.message_type
    END as tipo_envio,
    COUNT(*) as total_mensagens,
    COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
    COUNT(CASE WHEN q.whatsapp_account_id IS NOT NULL AND q.campaign_id IS NULL THEN 1 END) as reserva_sem_campanha,
    CASE 
        WHEN COUNT(CASE WHEN q.whatsapp_account_id IS NOT NULL AND q.campaign_id IS NULL THEN 1 END) > 0 THEN '⚠️ PROBLEMA: Número reserva usado fora de campanha!'
        ELSE '✅ OK: Números reserva só em campanhas'
    END as status_validacao
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR q.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   )
GROUP BY 
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Número Principal/Global'
        ELSE 'Número Reserva'
    END,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        ELSE q.message_type
    END
ORDER BY tipo_numero, tipo_envio;

-- =====================================================
-- 8. ÚLTIMAS 50 MENSAGENS ENVIADAS (TODOS OS TIPOS)
-- =====================================================
SELECT 
    '📨 ÚLTIMAS 50 MENSAGENS ENVIADAS' as info,
    q.id,
    q.phone,
    LEFT(q.message, 80) as message_preview,
    s.name as store_name,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        ELSE q.message_type
    END as tipo_envio,
    CASE 
        WHEN q.whatsapp_account_id IS NULL THEN 'Principal/Global'
        ELSE 'Reserva (' || COALESCE(wa.phone, q.whatsapp_account_id::text) || ')'
    END as numero_usado,
    q.status,
    q.sent_at,
    q.error_message,
    q.created_at
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.whatsapp_accounts wa ON wa.id = q.whatsapp_account_id
WHERE (LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR q.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   ))
AND q.status = 'SENT'
ORDER BY q.sent_at DESC
LIMIT 50;

-- =====================================================
-- 9. MENSAGENS FALHADAS (ÚLTIMAS 100)
-- =====================================================
SELECT 
    '❌ MENSAGENS FALHADAS (ÚLTIMAS 100)' as info,
    q.id,
    q.phone,
    LEFT(q.message, 80) as message_preview,
    s.name as store_name,
    CASE 
        WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
        WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
        WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
        WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
        ELSE q.message_type
    END as tipo_envio,
    q.status,
    q.error_message,
    q.retry_count,
    q.created_at,
    q.updated_at
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE (LOWER(s.name) LIKE '%loungerie%'
   OR LOWER(s.site_slug) LIKE '%loungerie%'
   OR q.store_id IN (
       SELECT id FROM sistemaretiradas.stores 
       WHERE LOWER(name) LIKE '%loungerie%' 
       OR LOWER(site_slug) LIKE '%loungerie%'
   ))
AND q.status = 'FAILED'
ORDER BY q.updated_at DESC
LIMIT 100;

-- =====================================================
-- 10. ESTATÍSTICAS GERAIS (HOJE, ÚLTIMOS 7 DIAS, ÚLTIMO MÊS)
-- =====================================================
SELECT 
    '📈 ESTATÍSTICAS GERAIS' as info,
    periodo,
    tipo_envio,
    total,
    enviadas,
    falhas,
    pendentes,
    ROUND(enviadas::numeric / NULLIF(total, 0) * 100, 2) as taxa_sucesso_percent
FROM (
    SELECT 
        'HOJE' as periodo,
        CASE 
            WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
            WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
            WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
            WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
            ELSE q.message_type
        END as tipo_envio,
        COUNT(*) as total,
        COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
        COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhas,
        COUNT(CASE WHEN q.status IN ('PENDING', 'SCHEDULED') THEN 1 END) as pendentes
    FROM sistemaretiradas.whatsapp_message_queue q
    LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
    WHERE (LOWER(s.name) LIKE '%loungerie%'
       OR LOWER(s.site_slug) LIKE '%loungerie%'
       OR q.store_id IN (
           SELECT id FROM sistemaretiradas.stores 
           WHERE LOWER(name) LIKE '%loungerie%' 
           OR LOWER(site_slug) LIKE '%loungerie%'
       ))
    AND q.created_at >= CURRENT_DATE
    GROUP BY tipo_envio
    
    UNION ALL
    
    SELECT 
        'ÚLTIMOS 7 DIAS' as periodo,
        CASE 
            WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
            WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
            WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
            WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
            ELSE q.message_type
        END as tipo_envio,
        COUNT(*) as total,
        COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
        COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhas,
        COUNT(CASE WHEN q.status IN ('PENDING', 'SCHEDULED') THEN 1 END) as pendentes
    FROM sistemaretiradas.whatsapp_message_queue q
    LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
    WHERE (LOWER(s.name) LIKE '%loungerie%'
       OR LOWER(s.site_slug) LIKE '%loungerie%'
       OR q.store_id IN (
           SELECT id FROM sistemaretiradas.stores 
           WHERE LOWER(name) LIKE '%loungerie%' 
           OR LOWER(site_slug) LIKE '%loungerie%'
       ))
    AND q.created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY tipo_envio
    
    UNION ALL
    
    SELECT 
        'ÚLTIMO MÊS' as periodo,
        CASE 
            WHEN q.campaign_id IS NOT NULL THEN 'CAMPANHA'
            WHEN q.message_type = 'TIME_CLOCK_ALERT' THEN 'ALERTA DE PONTO'
            WHEN q.message_type = 'CASHBACK' THEN 'CASHBACK'
            WHEN q.message_type = 'NOTIFICATION' THEN 'NOTIFICAÇÃO'
            ELSE q.message_type
        END as tipo_envio,
        COUNT(*) as total,
        COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
        COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhas,
        COUNT(CASE WHEN q.status IN ('PENDING', 'SCHEDULED') THEN 1 END) as pendentes
    FROM sistemaretiradas.whatsapp_message_queue q
    LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
    WHERE (LOWER(s.name) LIKE '%loungerie%'
       OR LOWER(s.site_slug) LIKE '%loungerie%'
       OR q.store_id IN (
           SELECT id FROM sistemaretiradas.stores 
           WHERE LOWER(name) LIKE '%loungerie%' 
           OR LOWER(site_slug) LIKE '%loungerie%'
       ))
    AND q.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY tipo_envio
) stats
ORDER BY periodo, tipo_envio;

