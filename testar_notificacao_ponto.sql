-- =====================================================
-- TESTAR NOTIFICAÇÕES DE PONTO
-- =====================================================

-- 1. Verificar se há registros de ponto recentes
SELECT 
    '📋 Registros de Ponto (últimas 2h)' as tipo,
    COUNT(*) as total,
    MAX(created_at) as ultimo_registro
FROM sistemaretiradas.time_clock_records
WHERE created_at >= NOW() - INTERVAL '2 hours';

-- 2. Verificar se há itens na fila
SELECT 
    '📬 Fila de Notificações' as tipo,
    status,
    COUNT(*) as total,
    MAX(created_at) as ultimo_item,
    MIN(created_at) as primeiro_item_pendente
FROM sistemaretiradas.time_clock_notification_queue
GROUP BY status
ORDER BY status;

-- 3. Ver detalhes dos itens pendentes
SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at,
    sent_at,
    SUBSTRING(message, 1, 100) as mensagem_preview
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10;

-- 4. Verificar configurações de notificação de ponto
SELECT 
    '🔔 Configurações' as tipo,
    wnc.id,
    wnc.admin_id,
    wnc.store_id,
    wnc.phone,
    wnc.active,
    wnc.notification_type,
    s.name as store_name,
    p.email as admin_email
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = wnc.admin_id
WHERE wnc.notification_type = 'CONTROLE_PONTO'
ORDER BY wnc.created_at DESC;

-- 5. Verificar se o trigger está habilitado
SELECT 
    '⚙️ Trigger' as tipo,
    tgname as trigger_name,
    tgrelid::regclass as tabela,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        ELSE tgenabled::TEXT
    END as status
FROM pg_trigger
WHERE tgname = 'trigger_send_time_clock_notification';

-- 6. Verificar se o cron job existe e está ativo
SELECT 
    '⏰ Cron Job' as tipo,
    jobid,
    jobname,
    schedule,
    CASE active 
        WHEN true THEN 'ATIVO'
        WHEN false THEN 'INATIVO'
        ELSE active::TEXT
    END as status
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 7. PROCESSAR FILA MANUALMENTE (executar esta linha para testar)
-- SELECT sistemaretiradas.process_time_clock_notification_queue();

