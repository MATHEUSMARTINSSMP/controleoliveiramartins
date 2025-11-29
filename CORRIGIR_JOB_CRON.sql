-- ============================================================================
-- SCRIPT PARA CORRIGIR O JOB DO PG_CRON
-- Execute este script se o schedule não estiver correto
-- ============================================================================

-- 1. Verificar job atual
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatico';

-- 2. Remover job atual (se existir)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-tiny-orders-automatico');
  RAISE NOTICE 'Job removido com sucesso';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job não existia ou erro ao remover: %', SQLERRM;
END $$;

-- 3. Recriar job com schedule explícito (a cada 5 minutos)
SELECT cron.schedule(
  'sync-tiny-orders-automatico',           -- Nome do job
  '*/5 * * * *',                           -- Cron: a cada 5 minutos (formato explícito)
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders();$$  -- Comando a executar
);

-- 4. Verificar se foi criado corretamente
SELECT 
  jobid,
  jobname,
  schedule,
  CASE 
    WHEN schedule = '*/5 * * * *' THEN '✅ CORRETO: A cada 5 minutos'
    WHEN schedule::text LIKE '%/5%' THEN '⚠️ Verificar formato'
    ELSE '⚠️ Schedule: ' || schedule::text
  END as status_schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatico';

-- 5. Verificar se a função existe e está acessível
SELECT 
  proname as nome_funcao,
  pronamespace::regnamespace as schema
FROM pg_proc
WHERE proname = 'chamar_sync_tiny_orders'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas');

-- ============================================================================
-- ✅ APÓS EXECUTAR, VERIFIQUE:
-- ============================================================================
-- 
-- 1. O job deve ter schedule = '*/5 * * * *' (string, não número)
-- 2. O job deve estar active = true
-- 3. A função chamar_sync_tiny_orders deve existir
--
-- Para verificar execuções:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico')
-- ORDER BY start_time DESC LIMIT 5;
--
-- ============================================================================

