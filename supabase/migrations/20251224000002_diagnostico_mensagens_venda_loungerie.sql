-- ============================================================================
-- DIAGNÓSTICO: Mensagens de Venda da Loja Loungerie
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Queries para investigar por que mensagens de venda não estão chegando
-- ============================================================================

-- 1. VERIFICAR ID DA LOJA LOUNGERIE
-- ============================================================================
SELECT 
    id,
    name,
    admin_id,
    whatsapp_ativo,
    site_slug,
    active
FROM sistemaretiradas.stores
WHERE LOWER(name) LIKE '%loungerie%'
   OR LOWER(name) LIKE '%loung%'
ORDER BY name;

-- 2. VERIFICAR MENSAGENS NA FILA PARA LOUNGERIE (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    LEFT(q.message, 100) as message_preview,
    q.store_id,
    s.name as store_name,
    q.status,
    q.priority,
    q.message_type,
    q.created_at,
    q.scheduled_for,
    q.sent_at,
    q.error_message,
    q.retry_count,
    q.metadata
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 50;

-- 3. CONTAR MENSAGENS POR STATUS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.status,
    COUNT(*) as total,
    COUNT(CASE WHEN q.error_message IS NOT NULL THEN 1 END) as com_erro
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY q.status
ORDER BY total DESC;

-- 4. VERIFICAR MENSAGENS FALHADAS COM ERROS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.error_message,
    q.retry_count,
    q.created_at,
    q.sent_at,
    s.name as store_name,
    LEFT(q.message, 150) as message_preview
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.status = 'FAILED'
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 20;

-- 5. VERIFICAR CONFIGURAÇÕES DE WHATSAPP DA LOJA
-- ============================================================================
SELECT 
    s.id as store_id,
    s.name as store_name,
    s.whatsapp_ativo,
    s.whatsapp_connection_status,
    s.whatsapp_connected_at,
    s.site_slug,
    wa.id as whatsapp_account_id,
    wa.phone_number,
    wa.instance_id,
    wa.status as account_status,
    wa.is_primary,
    wa.is_backup1,
    wa.is_backup2,
    wa.is_backup3
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_accounts wa ON wa.store_id = s.id
WHERE LOWER(s.name) LIKE '%loungerie%' OR LOWER(s.name) LIKE '%loung%'
ORDER BY s.name, wa.is_primary DESC, wa.created_at;

-- 6. VERIFICAR CONFIGURAÇÕES DE NOTIFICAÇÕES WHATSAPP (TIPO VENDA)
-- ============================================================================
-- IMPORTANTE: O sistema usa a tabela whatsapp_notification_config, não store_notification_recipients
SELECT 
    wnc.id,
    wnc.admin_id,
    p.name as admin_name,
    wnc.notification_type,
    wnc.phone,
    wnc.store_id,
    s.name as store_name,
    wnc.active,
    wnc.created_at,
    wnc.updated_at,
    CASE 
        WHEN wnc.store_id IS NULL THEN 'GLOBAL (todas as lojas)'
        ELSE 'ESPECÍFICO DA LOJA'
    END as escopo
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.profiles p ON p.id = wnc.admin_id
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
WHERE wnc.notification_type = 'VENDA'
AND (
    wnc.store_id IN (
        SELECT id FROM sistemaretiradas.stores 
        WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
    )
    OR wnc.store_id IS NULL  -- Configurações globais também afetam a loja
)
AND wnc.admin_id IN (
    SELECT admin_id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
ORDER BY wnc.store_id NULLS LAST, wnc.active DESC, wnc.created_at DESC;

-- 7. VERIFICAR VENDAS RECENTES DA LOJA (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    s.id as sale_id,
    s.data_venda,
    s.valor,
    s.qtd_pecas,
    s.colaboradora_id,
    p.name as colaboradora_name,
    s.store_id,
    st.name as store_name,
    s.created_at
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.stores st ON st.id = s.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 20;

-- 8. VERIFICAR SE HÁ MENSAGENS PENDENTES NA FILA (AGUARDANDO PROCESSAMENTO)
-- ============================================================================
SELECT 
    COUNT(*) as total_pendentes,
    COUNT(CASE WHEN q.priority <= 3 THEN 1 END) as prioridade_critica,
    COUNT(CASE WHEN q.message_type = 'NOTIFICATION' THEN 1 END) as tipo_notificacao,
    MIN(q.created_at) as mais_antiga,
    MAX(q.created_at) as mais_recente
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.status IN ('PENDING', 'SCHEDULED')
AND q.created_at >= NOW() - INTERVAL '7 days';

-- 9. VERIFICAR PROCESSAMENTO DA FILA (ÚLTIMAS 2H)
-- ============================================================================
SELECT 
    q.status,
    COUNT(*) as total,
    AVG(EXTRACT(EPOCH FROM (q.sent_at - q.created_at))) as tempo_medio_segundos,
    MIN(q.created_at) as primeira,
    MAX(q.created_at) as ultima
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.created_at >= NOW() - INTERVAL '2 hours'
GROUP BY q.status
ORDER BY total DESC;

-- 10. VERIFICAR SE O ADMIN DA LOJA TEM TELEFONE CONFIGURADO
-- ============================================================================
SELECT 
    s.id as store_id,
    s.name as store_name,
    s.admin_id,
    p.name as admin_name,
    p.email as admin_email,
    p.phone as admin_phone,
    CASE 
        WHEN p.phone IS NULL OR p.phone = '' THEN 'SEM TELEFONE'
        ELSE 'COM TELEFONE'
    END as status_telefone
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE LOWER(s.name) LIKE '%loungerie%' OR LOWER(s.name) LIKE '%loung%';

-- 11. VERIFICAR MENSAGENS COM METADATA DE VENDA (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.sent_at,
    q.error_message,
    q.metadata->>'source' as source,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'order_id' as order_id,
    q.metadata->>'colaboradora' as colaboradora,
    LEFT(q.message, 200) as message_preview
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND q.metadata->>'notification_type' = 'VENDA'
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC;

-- 12. VERIFICAR CRON JOB DE PROCESSAMENTO DA FILA
-- ============================================================================
-- Verificar se o cron está configurado e funcionando
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM pg_catalog.pg_cron.job
WHERE command LIKE '%process-whatsapp-queue%'
   OR command LIKE '%whatsapp_message_queue%'
ORDER BY jobid;

-- 13. RESUMO GERAL PARA LOUNGERIE
-- ============================================================================
WITH store_info AS (
    SELECT id, name, admin_id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
    LIMIT 1
)
SELECT 
    'LOJA' as tipo,
    s.name as info,
    CASE 
        WHEN s.whatsapp_ativo THEN 'ATIVO'
        ELSE 'INATIVO'
    END as valor
FROM sistemaretiradas.stores s
WHERE s.id = (SELECT id FROM store_info)
UNION ALL
SELECT 
    'WHATSAPP CONECTADO' as tipo,
    CASE 
        WHEN s.whatsapp_connection_status = 'connected' THEN 'SIM'
        ELSE 'NÃO (' || COALESCE(s.whatsapp_connection_status, 'desconhecido') || ')'
    END as info,
    COALESCE(s.whatsapp_connected_at::text, 'nunca') as valor
FROM sistemaretiradas.stores s
WHERE s.id = (SELECT id FROM store_info)
UNION ALL
SELECT 
    'MENSAGENS PENDENTES (24H)' as tipo,
    COUNT(*)::text as info,
    '' as valor
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id = (SELECT id FROM store_info)
AND q.status IN ('PENDING', 'SCHEDULED')
AND q.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS FALHADAS (24H)' as tipo,
    COUNT(*)::text as info,
    '' as valor
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id = (SELECT id FROM store_info)
AND q.status = 'FAILED'
AND q.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS ENVIADAS (24H)' as tipo,
    COUNT(*)::text as info,
    '' as valor
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.store_id = (SELECT id FROM store_info)
AND q.status = 'SENT'
AND q.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'VENDAS CRIADAS (24H)' as tipo,
    COUNT(*)::text as info,
    '' as valor
FROM sistemaretiradas.sales s
WHERE s.store_id = (SELECT id FROM store_info)
AND s.created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'CONFIG NOTIFICAÇÕES VENDA' as tipo,
    COUNT(*)::text as info,
    COUNT(CASE WHEN wnc.active = true THEN 1 END)::text || ' ativas' as valor
FROM sistemaretiradas.whatsapp_notification_config wnc
WHERE wnc.notification_type = 'VENDA'
AND (
    wnc.store_id = (SELECT id FROM store_info)
    OR (wnc.store_id IS NULL AND wnc.admin_id = (SELECT admin_id FROM store_info))
);

-- 14. VERIFICAR SE HÁ PROBLEMAS COM O ENVIO DIRETO (SEM FILA)
-- ============================================================================
-- As mensagens do LojaDashboard são enviadas diretamente, não via fila
-- Verificar logs do console do navegador ou logs do Netlify Function
-- Esta query verifica se há vendas sem mensagens correspondentes na fila
SELECT 
    s.id as sale_id,
    s.data_venda,
    s.valor,
    s.created_at as venda_criada_em,
    s.colaboradora_id,
    p.name as colaboradora_name,
    s.store_id,
    st.name as store_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.whatsapp_message_queue q
            WHERE q.metadata->>'order_id' = s.id::text
            OR (q.metadata->>'source' = 'sync-tiny-orders' AND q.created_at BETWEEN s.created_at - INTERVAL '5 minutes' AND s.created_at + INTERVAL '5 minutes')
        ) THEN 'TEM MENSAGEM NA FILA'
        ELSE 'SEM MENSAGEM NA FILA (envio direto ou erro)'
    END as status_mensagem
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.stores st ON st.id = s.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.colaboradora_id
WHERE s.store_id IN (
    SELECT id FROM sistemaretiradas.stores 
    WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%'
)
AND s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 20;

