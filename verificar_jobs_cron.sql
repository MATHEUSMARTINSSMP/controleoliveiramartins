-- ============================================================================
-- Script para Verificar Jobs pg_cron de Sincronização
-- ============================================================================

-- 1. Verificar se todos os jobs foram criados
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname LIKE 'sync-%'
ORDER BY jobname;

-- 2. Verificar execuções recentes de cada job
SELECT 
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duracao_segundos
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'sync-%'
ORDER BY jrd.start_time DESC NULLS LAST
LIMIT 50;

-- 3. Verificar execuções do job de 1 minuto especificamente
SELECT 
  start_time,
  end_time,
  status,
  return_message,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duracao_segundos
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-incremental-1min')
ORDER BY start_time DESC
LIMIT 20;

-- 4. Verificar se os jobs estão ativos
SELECT 
  jobname,
  active,
  schedule,
  CASE 
    WHEN active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as status
FROM cron.job 
WHERE jobname LIKE 'sync-%'
ORDER BY jobname;

-- 5. Contar execuções por status nos últimos 30 minutos
SELECT 
  j.jobname,
  jrd.status,
  COUNT(*) as total_execucoes
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'sync-%'
  AND jrd.start_time > NOW() - INTERVAL '30 minutes'
GROUP BY j.jobname, jrd.status
ORDER BY j.jobname, jrd.status;

