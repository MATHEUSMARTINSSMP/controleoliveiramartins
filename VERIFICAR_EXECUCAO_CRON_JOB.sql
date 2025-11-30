-- ============================================================================
-- QUERY: Verificar Execução do Cron Job
-- Descrição: Ver logs e status de execução do cron job
-- ============================================================================

-- ============================================================================
-- 1. VER ÚLTIMAS EXECUÇÕES DO JOB (Últimas 20)
-- ============================================================================

SELECT 
    runid,
    job_pid,
    status,
    return_message,
    start_time,
    end_time,
    end_time - start_time as duracao,
    CASE 
        WHEN status = 'succeeded' THEN '✅ SUCESSO'
        WHEN status = 'failed' THEN '❌ FALHOU'
        WHEN status = 'running' THEN '🔄 RODANDO'
        ELSE status
    END as status_formatado
FROM cron.job_run_details
WHERE jobid = 35  -- ID do job processar-fila-whatsapp-cashback
ORDER BY start_time DESC
LIMIT 20;

-- ============================================================================
-- 2. VER ESTATÍSTICAS DE EXECUÇÃO (Últimas 24 horas)
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total_execucoes,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::NUMERIC(10,2) as tempo_medio_segundos,
    MIN(start_time) as primeira_execucao,
    MAX(start_time) as ultima_execucao
FROM cron.job_run_details
WHERE jobid = 35
  AND start_time >= NOW() - INTERVAL '24 hours'
GROUP BY status;

-- ============================================================================
-- 3. VER EXECUÇÕES COM ERRO
-- ============================================================================

SELECT 
    runid,
    start_time,
    end_time,
    status,
    return_message as mensagem_erro
FROM cron.job_run_details
WHERE jobid = 35
  AND status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- 4. VER EXECUÇÕES RECENTES (Última hora)
-- ============================================================================

SELECT 
    runid,
    start_time,
    end_time,
    CASE 
        WHEN end_time IS NULL THEN '🔄 AINDA RODANDO'
        WHEN end_time - start_time < INTERVAL '1 second' THEN '⚡ MUITO RÁPIDO'
        ELSE (end_time - start_time)::TEXT
    END as duracao,
    status,
    CASE 
        WHEN status = 'succeeded' THEN '✅'
        WHEN status = 'failed' THEN '❌'
        WHEN status = 'running' THEN '🔄'
        ELSE '❓'
    END as emoji_status,
    LEFT(return_message, 100) as mensagem_resumida
FROM cron.job_run_details
WHERE jobid = 35
  AND start_time >= NOW() - INTERVAL '1 hour'
ORDER BY start_time DESC;

-- ============================================================================
-- 5. VERIFICAR SE ESTÁ PROCESSANDO AS MENSAGENS
-- ============================================================================

-- Comparar execuções do cron com processamento de mensagens
SELECT 
    'Cron Job Executou' as tipo,
    COUNT(*) as total
FROM cron.job_run_details
WHERE jobid = 35
  AND start_time >= NOW() - INTERVAL '1 hour'
  AND status = 'succeeded'

UNION ALL

SELECT 
    'Mensagens Processadas' as tipo,
    COUNT(*) as total
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE (status = 'SENT' OR status = 'SKIPPED' OR status = 'FAILED')
  AND last_attempt_at >= NOW() - INTERVAL '1 hour';

-- ============================================================================
-- 6. VER ÚLTIMA EXECUÇÃO DO JOB
-- ============================================================================

SELECT 
    runid,
    start_time,
    end_time,
    status,
    return_message,
    end_time - start_time as duracao
FROM cron.job_run_details
WHERE jobid = 35
ORDER BY start_time DESC
LIMIT 1;

