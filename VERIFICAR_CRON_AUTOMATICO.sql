-- ============================================================================
-- Script para Verificar se o Cron Automático está Funcionando
-- ============================================================================

-- 1. Verificar se o job está ativo
SELECT 
  '=== STATUS DOS JOBS ===' as info;

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
WHERE jobname = 'sync-incremental-1min'
ORDER BY jobname;

-- 2. Verificar últimas execuções do cron (últimas 10)
SELECT 
  '=== ÚLTIMAS EXECUÇÕES (últimas 10) ===' as info;

SELECT 
  start_time,
  end_time,
  status,
  return_message,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duracao_segundos
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-incremental-1min')
ORDER BY start_time DESC
LIMIT 10;

-- 3. Verificar se a função está sendo chamada
SELECT 
  '=== FUNÇÃO chamar_sync_tiny_orders ===' as info;

SELECT 
  proname as nome_funcao,
  prosrc as codigo
FROM pg_proc
WHERE proname = 'chamar_sync_tiny_orders'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas');

-- 4. Verificar estrutura da tabela erp_sync_logs
SELECT 
  '=== ESTRUTURA DA TABELA erp_sync_logs ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'erp_sync_logs'
ORDER BY ordinal_position;

-- 5. Verificar logs de sincronização (últimas 10)
SELECT 
  '=== LOGS DE SINCRONIZAÇÃO (últimas 10) ===' as info;

SELECT 
  *
FROM sistemaretiradas.erp_sync_logs
WHERE tipo_sync = 'incremental_1min'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar último pedido no banco vs API
SELECT 
  '=== ÚLTIMO PEDIDO NO BANCO ===' as info;

SELECT 
  numero_pedido,
  cliente_nome,
  valor_total,
  data_pedido,
  sync_at
FROM sistemaretiradas.tiny_orders
WHERE store_id = 'cee7d359-0240-4131-87a2-21ae44bd1bb4'
  AND numero_pedido IS NOT NULL
ORDER BY numero_pedido DESC
LIMIT 5;

-- ============================================================================
-- ✅ Execute este script para verificar se o cron está funcionando
-- ============================================================================

