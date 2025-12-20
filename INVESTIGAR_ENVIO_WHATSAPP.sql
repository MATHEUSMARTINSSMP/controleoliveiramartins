-- =====================================================
-- INVESTIGAÇÃO: Por que mensagens não estão chegando?
-- =====================================================
-- Este script investiga todo o fluxo de envio de mensagens
-- desde a criação até o envio final
-- =====================================================

-- 1. VERIFICAR MENSAGENS NA FILA (status atual)
SELECT 
    id,
    phone,
    message,
    store_id,
    priority,
    message_type,
    status,
    campaign_id,
    whatsapp_account_id,
    scheduled_for,
    allowed_start_hour,
    allowed_end_hour,
    sent_at,
    error_message,
    retry_count,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_message_queue
ORDER BY created_at DESC
LIMIT 20;

-- 2. CONTAR MENSAGENS POR STATUS
SELECT 
    status,
    COUNT(*) as total,
    COUNT(CASE WHEN campaign_id IS NOT NULL THEN 1 END) as de_campanha,
    COUNT(CASE WHEN message_type = 'CAMPAIGN' THEN 1 END) as tipo_campanha,
    MIN(created_at) as mais_antiga,
    MAX(created_at) as mais_recente
FROM sistemaretiradas.whatsapp_message_queue
GROUP BY status
ORDER BY status;

-- 3. VERIFICAR CAMPANHAS RECENTES
SELECT 
    id,
    name,
    status,
    store_id,
    total_recipients,
    sent_count,
    failed_count,
    created_at,
    started_at,
    completed_at
FROM sistemaretiradas.whatsapp_campaigns
ORDER BY created_at DESC
LIMIT 10;

-- 4. VERIFICAR MENSAGENS COM ERRO
SELECT 
    id,
    phone,
    message_type,
    status,
    error_message,
    retry_count,
    created_at,
    updated_at
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'FAILED'
   OR error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- 5. VERIFICAR MENSAGENS PENDENTES (que deveriam estar sendo processadas)
SELECT 
    id,
    phone,
    message_type,
    priority,
    status,
    scheduled_for,
    allowed_start_hour,
    allowed_end_hour,
    created_at,
    CASE 
        WHEN scheduled_for IS NOT NULL AND scheduled_for > NOW() THEN 'AGENDADA_FUTURO'
        WHEN scheduled_for IS NOT NULL AND scheduled_for <= NOW() THEN 'AGENDADA_PASSADA'
        WHEN scheduled_for IS NULL THEN 'SEM_AGENDAMENTO'
    END as status_agendamento,
    CASE 
        WHEN allowed_start_hour IS NOT NULL 
        THEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') >= allowed_start_hour
             AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') < COALESCE(allowed_end_hour, 24)
        ELSE true
    END as dentro_janela_horario
FROM sistemaretiradas.whatsapp_message_queue
WHERE status IN ('PENDING', 'SCHEDULED')
ORDER BY priority ASC, created_at ASC
LIMIT 50;

-- 6. VERIFICAR SE HÁ CRON JOBS CONFIGURADOS
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
FROM cron.job
WHERE command LIKE '%whatsapp%' 
   OR command LIKE '%message_queue%'
ORDER BY jobid;

-- 7. VERIFICAR ÚLTIMAS MENSAGENS ENVIADAS (se houver)
SELECT 
    id,
    phone,
    status,
    sent_at,
    created_at,
    TIMESTAMP_DIFF(sent_at, created_at, SECOND) as tempo_processamento_segundos
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'SENT'
   AND sent_at IS NOT NULL
ORDER BY sent_at DESC
LIMIT 20;

-- 8. VERIFICAR CONFIGURAÇÃO DE WHATSAPP (números conectados)
SELECT 
    s.name as loja_nome,
    wc.uazapi_status as status_principal,
    wc.uazapi_phone_number as numero_principal,
    s.whatsapp_ativo as principal_ativo,
    COUNT(wa.id) as total_backups,
    COUNT(CASE WHEN wa.is_connected = true THEN 1 END) as backups_conectados
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.whatsapp_credentials wc ON wc.admin_id = s.admin_id AND wc.is_global = false
LEFT JOIN sistemaretiradas.whatsapp_accounts wa ON wa.store_id = s.id
GROUP BY s.id, s.name, wc.uazapi_status, wc.uazapi_phone_number, s.whatsapp_ativo
ORDER BY s.name;

-- 9. VERIFICAR FUNÇÃO get_next_whatsapp_messages (teste manual)
-- Esta função é chamada pelo process-whatsapp-queue
SELECT * FROM sistemaretiradas.get_next_whatsapp_messages(10);

-- 10. DIAGNÓSTICO COMPLETO DA ÚLTIMA CAMPANHA
WITH ultima_campanha AS (
    SELECT id, store_id, total_recipients, sent_count, failed_count, created_at
    FROM sistemaretiradas.whatsapp_campaigns
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT 
    'Campanha' as tipo,
    uc.id::text as id,
    uc.total_recipients::text as total,
    uc.sent_count::text as enviadas,
    uc.failed_count::text as falhas,
    uc.created_at::text as criado_em
FROM ultima_campanha uc
UNION ALL
SELECT 
    'Mensagens na Fila' as tipo,
    COUNT(*)::text as id,
    COUNT(*)::text as total,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END)::text as enviadas,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::text as falhas,
    MAX(created_at)::text as criado_em
FROM sistemaretiradas.whatsapp_message_queue
WHERE campaign_id = (SELECT id FROM ultima_campanha LIMIT 1);

