-- =====================================================
-- VERIFICAR SE MENSAGEM FOI REALMENTE ENVIADA
-- =====================================================

-- 1. VER STATUS DA MENSAGEM QUE FOI PROCESSADA
SELECT 
    id,
    phone,
    message,
    status,
    sent_at,
    error_message,
    retry_count,
    campaign_id,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (sent_at - created_at))::INTEGER as tempo_processamento_segundos
FROM sistemaretiradas.whatsapp_message_queue
WHERE id = 'd20e50a7-e433-4a1e-80ff-32e3b175d3f4'
   OR phone = '(96) 98111-3307'
ORDER BY created_at DESC
LIMIT 5;

-- 2. VER STATUS DA CAMPANHA
SELECT 
    id,
    name,
    status,
    total_recipients,
    sent_count,
    failed_count,
    created_at,
    started_at,
    completed_at
FROM sistemaretiradas.whatsapp_campaigns
WHERE id = 'c6697139-5f34-449c-af0c-db558bb423be';

-- 3. VER TODAS AS MENSAGENS ENVIADAS RECENTEMENTE (últimas 24h)
SELECT 
    id,
    phone,
    message_type,
    status,
    sent_at,
    error_message,
    campaign_id,
    EXTRACT(EPOCH FROM (sent_at - created_at))::INTEGER as tempo_processamento_segundos,
    created_at
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'SENT'
   AND sent_at >= NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC
LIMIT 20;

-- 4. VERIFICAR LOGS DE EXECUÇÃO DO CRON (últimas 10)
SELECT 
    runid,
    status,
    return_message,
    start_time,
    end_time,
    EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC(10,3) as duracao_segundos
FROM cron.job_run_details
WHERE jobid = 82  -- ID do cron job processar-fila-whatsapp-unificada
ORDER BY start_time DESC
LIMIT 10;

-- 5. ESTATÍSTICAS DE PROCESSAMENTO (últimas 24h)
SELECT 
    DATE_TRUNC('hour', start_time) as hora,
    COUNT(*) as total_execucoes,
    COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as sucessos,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as falhas,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC(10,3) as tempo_medio_segundos
FROM cron.job_run_details
WHERE jobid = 82
  AND start_time >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', start_time)
ORDER BY hora DESC;

