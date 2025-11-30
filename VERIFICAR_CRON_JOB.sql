-- ============================================================================
-- QUERY: Verificar Status do Cron Job de Processamento
-- Descrição: Verifica se o cron job está configurado e funcionando
-- ============================================================================

-- ============================================================================
-- 1. VER TODOS OS CRON JOBS CONFIGURADOS
-- ============================================================================

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
ORDER BY jobid;

-- ============================================================================
-- 2. VER O JOB ESPECÍFICO DE PROCESSAR FILA
-- ============================================================================

SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active,
    database,
    username
FROM cron.job
WHERE jobname = 'processar-fila-whatsapp-cashback';

-- ============================================================================
-- 3. VER LOGS DE EXECUÇÃO DO JOB (Últimas 10 execuções)
-- ============================================================================

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
    end_time - start_time as duracao
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid FROM cron.job 
    WHERE jobname = 'processar-fila-whatsapp-cashback'
    LIMIT 1
)
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- 4. VERIFICAR SE pg_cron ESTÁ HABILITADO
-- ============================================================================

SELECT 
    extname as extensao,
    extversion as versao
FROM pg_extension
WHERE extname = 'pg_cron';

-- ============================================================================
-- 5. VERIFICAR SE A FUNÇÃO HELPER EXISTE
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    routine_schema
FROM information_schema.routines
WHERE routine_schema = 'sistemaretiradas'
  AND routine_name = 'chamar_processar_fila_whatsapp'
  OR routine_name = 'processar_fila_whatsapp_cashback';

