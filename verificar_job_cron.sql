-- ============================================================================
-- QUERIES PARA VERIFICAR O JOB DO PG_CRON
-- Execute estas queries no Supabase SQL Editor
-- ============================================================================

-- 1. Verificar se o job foi criado e seus detalhes
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
  jobid
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatico';

-- 2. Verificar o schedule em formato legível
SELECT 
  jobid,
  jobname,
  schedule,
  -- Converter schedule para formato cron legível
  CASE 
    WHEN schedule = '*/5 * * * *' THEN 'A cada 5 minutos'
    WHEN schedule LIKE '%/5%' THEN 'A cada 5 minutos (formato customizado)'
    ELSE schedule
  END as schedule_descricao,
  active,
  command
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatico';

-- 3. Verificar últimas execuções do job
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
    WHEN end_time IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (end_time - start_time)) || ' segundos'
    ELSE 'Ainda executando...'
  END as duracao
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico'
)
ORDER BY start_time DESC
LIMIT 10;

-- 4. Verificar se a função existe
SELECT 
  proname as nome_funcao,
  pronamespace::regnamespace as schema,
  proargtypes::regtype[] as tipos_argumentos,
  prosrc as codigo_funcao
FROM pg_proc
WHERE proname = 'chamar_sync_tiny_orders'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas');

-- 5. Verificar todas as extensões habilitadas (incluindo pg_cron)
SELECT 
  extname as nome_extensao,
  extversion as versao
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'http')
ORDER BY extname;

-- 6. Testar se conseguimos chamar a função manualmente
SELECT sistemaretiradas.chamar_sync_tiny_orders();

