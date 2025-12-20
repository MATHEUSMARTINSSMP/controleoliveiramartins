-- =====================================================
-- TESTE COMPLETO: Verificar Cron Job de WhatsApp Queue
-- =====================================================
-- Execute estas queries para verificar se o cron job
-- foi criado corretamente e está funcionando
-- =====================================================

-- 1. VERIFICAR SE EXTENSÃO pg_cron ESTÁ HABILITADA
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) THEN '✅ pg_cron está habilitado'
        ELSE '❌ pg_cron NÃO está habilitado (execute: CREATE EXTENSION IF NOT EXISTS pg_cron;)'
    END as status_pg_cron;

-- 2. VERIFICAR SE EXTENSÃO pg_net ESTÁ HABILITADA (para chamadas HTTP)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
        ) THEN '✅ pg_net está habilitado'
        ELSE '❌ pg_net NÃO está habilitado (execute: CREATE EXTENSION IF NOT EXISTS pg_net;)'
    END as status_pg_net;

-- 3. VERIFICAR SE FUNÇÃO processar_fila_whatsapp_unificada EXISTE
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'sistemaretiradas'
            AND p.proname = 'processar_fila_whatsapp_unificada'
        ) THEN '✅ Função processar_fila_whatsapp_unificada existe'
        ELSE '❌ Função NÃO existe (execute a migration novamente)'
    END as status_funcao;

-- 4. VERIFICAR CRON JOB CRIADO
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobid as id,
    CASE 
        WHEN active = true THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END as status_cron
FROM cron.job
WHERE jobname = 'processar-fila-whatsapp-unificada';

-- 5. VER TODOS OS CRON JOBS (para comparação)
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active = true THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END as status
FROM cron.job
ORDER BY jobid;

-- 6. VER LOGS DE EXECUÇÃO DO CRON JOB (últimas 20 execuções)
SELECT 
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time,
    CASE 
        WHEN end_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER
        ELSE NULL
    END as duracao_segundos,
    CASE 
        WHEN status = 'succeeded' THEN '✅ SUCESSO'
        WHEN status = 'failed' THEN '❌ FALHOU'
        WHEN status = 'running' THEN '🔄 RODANDO'
        ELSE status
    END as status_formatado
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid FROM cron.job 
    WHERE jobname = 'processar-fila-whatsapp-unificada'
    LIMIT 1
)
ORDER BY start_time DESC
LIMIT 20;

-- 7. TESTAR FUNÇÃO MANUALMENTE (retorna JSON)
-- Esta função tenta chamar a Netlify Function via HTTP
SELECT sistemaretiradas.processar_fila_whatsapp_unificada() as resultado_teste;

-- 8. VERIFICAR SE HÁ MENSAGENS PENDENTES NA FILA
SELECT 
    COUNT(*) as total_pendentes,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
    COUNT(CASE WHEN status = 'SENDING' THEN 1 END) as sending,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
    MIN(created_at) as mais_antiga,
    MAX(created_at) as mais_recente
FROM sistemaretiradas.whatsapp_message_queue;

-- 9. VER MENSAGENS PENDENTES (que deveriam ser processadas)
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
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') as hora_atual_brasil,
    CASE 
        WHEN scheduled_for IS NOT NULL AND scheduled_for > NOW() THEN '⏰ AGENDADA FUTURO'
        WHEN scheduled_for IS NOT NULL AND scheduled_for <= NOW() THEN '✅ AGENDADA PRONTA'
        WHEN scheduled_for IS NULL THEN '✅ SEM AGENDAMENTO'
    END as status_agendamento,
    CASE 
        WHEN allowed_start_hour IS NOT NULL 
        THEN (
            EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') >= allowed_start_hour
            AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') < COALESCE(allowed_end_hour, 24)
        )
        ELSE true
    END as dentro_janela_horario
FROM sistemaretiradas.whatsapp_message_queue
WHERE status IN ('PENDING', 'SCHEDULED')
ORDER BY priority ASC, created_at ASC
LIMIT 10;

-- 10. TESTAR FUNÇÃO get_next_whatsapp_messages (usada pelo process-whatsapp-queue)
-- Esta é a função que o cron job chama indiretamente (via Netlify Function)
SELECT * FROM sistemaretiradas.get_next_whatsapp_messages(10);

-- 11. RESUMO COMPLETO
SELECT 
    'Cron Job' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN active = true THEN 1 END) as ativos,
    COUNT(CASE WHEN active = false THEN 1 END) as inativos
FROM cron.job
WHERE jobname = 'processar-fila-whatsapp-unificada'
UNION ALL
SELECT 
    'Mensagens na Fila' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN status IN ('PENDING', 'SCHEDULED') THEN 1 END) as ativos,
    COUNT(CASE WHEN status NOT IN ('PENDING', 'SCHEDULED') THEN 1 END) as inativos
FROM sistemaretiradas.whatsapp_message_queue
UNION ALL
SELECT 
    'Logs de Execução (últimas 24h)' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as ativos,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as inativos
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid FROM cron.job 
    WHERE jobname = 'processar-fila-whatsapp-unificada'
    LIMIT 1
)
AND start_time >= NOW() - INTERVAL '24 hours';

-- =====================================================
-- INSTRUÇÕES DE TROUBLESHOOTING
-- =====================================================

-- Se cron job não existe:
-- 1. Verifique se a migration foi executada completamente
-- 2. Verifique se pg_cron está habilitado
-- 3. Execute a migration novamente

-- Se cron job existe mas não executa:
-- 1. Verifique se active = true
-- 2. Verifique logs em cron.job_run_details
-- 3. Verifique se pg_net está habilitado (para chamadas HTTP)

-- Se função retorna erro:
-- 1. Verifique se Netlify Function está online
-- 2. Verifique se URL está correta em app_config
-- 3. Verifique logs no Netlify

-- Se mensagens não são processadas:
-- 1. Verifique se há mensagens com status PENDING
-- 2. Verifique se estão dentro da janela de horário
-- 3. Verifique se scheduled_for não está no futuro
-- 4. Teste função get_next_whatsapp_messages manualmente

