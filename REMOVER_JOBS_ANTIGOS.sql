-- ============================================================================
-- Script para Remover Jobs Antigos que Estão Falhando
-- ============================================================================

-- Remover jobs antigos que não são mais necessários
DO $$
BEGIN
  -- Remover job sync-tiny-orders-automatic (antigo)
  PERFORM cron.unschedule('sync-tiny-orders-automatic');
  RAISE NOTICE 'Job sync-tiny-orders-automatic removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job sync-tiny-orders-automatic não existe ou já foi removido';
END $$;

DO $$
BEGIN
  -- Remover job sync-tiny-orders-automatico (antigo)
  PERFORM cron.unschedule('sync-tiny-orders-automatico');
  RAISE NOTICE 'Job sync-tiny-orders-automatico removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job sync-tiny-orders-automatico não existe ou já foi removido';
END $$;

-- Verificar jobs restantes
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as status
FROM cron.job 
WHERE jobname LIKE 'sync-%'
ORDER BY jobname;

