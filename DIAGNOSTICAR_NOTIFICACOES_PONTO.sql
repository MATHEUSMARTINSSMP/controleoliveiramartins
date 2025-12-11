-- =====================================================
-- DIAGNÓSTICO: NOTIFICAÇÕES DE PONTO NÃO ESTÃO SENDO ENVIADAS
-- =====================================================

-- 1. Verificar se há itens na fila
SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.time_clock_notification_queue;

-- 2. Verificar itens pendentes recentes
SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at,
    sent_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar trigger
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_send_time_clock_notification';

-- 4. Verificar cron job
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 5. Verificar configurações de notificação
SELECT 
    admin_id,
    notification_type,
    phone,
    store_id,
    active,
    created_at
FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'CONTROLE_PONTO'
ORDER BY created_at DESC;

-- 6. Verificar configuração principal de notificações de ponto
SELECT 
    store_id,
    notifications_enabled,
    use_global_whatsapp,
    recipient_phones,
    updated_at
FROM sistemaretiradas.time_clock_notification_config
ORDER BY updated_at DESC;

-- 7. Verificar registros de ponto recentes
SELECT 
    id,
    colaboradora_id,
    store_id,
    tipo_registro,
    horario,
    created_at
FROM sistemaretiradas.time_clock_records
ORDER BY created_at DESC
LIMIT 5;

-- 8. Verificar se pg_net está habilitado
SELECT 
    extname,
    extversion
FROM pg_extension
WHERE extname = 'pg_net';

