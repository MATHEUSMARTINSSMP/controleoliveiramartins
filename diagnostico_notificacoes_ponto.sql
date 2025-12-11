-- =====================================================
-- DIAGNÓSTICO: NOTIFICAÇÕES DE PONTO
-- =====================================================

-- 1. Verificar se há registros de ponto recentes
SELECT 
    'Registros de Ponto (últimas 24h)' as tipo,
    COUNT(*) as total,
    MAX(created_at) as ultimo_registro
FROM sistemaretiradas.time_clock_records
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 2. Verificar se há itens na fila de notificações
SELECT 
    'Fila de Notificações' as tipo,
    status,
    COUNT(*) as total,
    MAX(created_at) as ultimo_item
FROM sistemaretiradas.time_clock_notification_queue
GROUP BY status;

-- 3. Verificar se há configurações de notificação de ponto ativas
SELECT 
    'Configurações de Notificação' as tipo,
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

-- 4. Verificar se o trigger existe
SELECT 
    'Trigger' as tipo,
    tgname as trigger_name,
    tgrelid::regclass as tabela,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_send_time_clock_notification';

-- 5. Verificar se a função existe
SELECT 
    'Função' as tipo,
    proname as function_name,
    prokind as kind
FROM pg_proc
WHERE proname IN ('send_time_clock_notification', 'process_time_clock_notification_queue');

-- 6. Verificar se o cron job existe
SELECT 
    'Cron Job' as tipo,
    jobid,
    jobname,
    schedule,
    active,
    jobid::regclass as details
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';

-- 7. Verificar últimos 10 registros de ponto e se geraram notificações
SELECT 
    tcr.id as record_id,
    tcr.tipo_registro,
    tcr.horario,
    p.name as colaboradora,
    s.name as loja,
    tcr.created_at,
    (SELECT COUNT(*) 
     FROM sistemaretiradas.time_clock_notification_queue tcnq 
     WHERE tcnq.time_clock_record_id = tcr.id) as notificacoes_geradas
FROM sistemaretiradas.time_clock_records tcr
LEFT JOIN sistemaretiradas.profiles p ON p.id = tcr.colaboradora_id
LEFT JOIN sistemaretiradas.stores s ON s.id = tcr.store_id
ORDER BY tcr.created_at DESC
LIMIT 10;

