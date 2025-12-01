-- ============================================================================
-- Verificar Status dos Cron Jobs de Sincronização Tiny ERP
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. VERIFICAR SE pg_cron ESTÁ HABILITADO
SELECT 
    '1. EXTENSÃO pg_cron' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
        ) THEN '✅ HABILITADA'
        ELSE '❌ NÃO HABILITADA - Execute: CREATE EXTENSION IF NOT EXISTS pg_cron;'
    END as status;

-- 2. VERIFICAR SE pg_net ESTÁ HABILITADO (necessário para chamadas HTTP)
SELECT 
    '2. EXTENSÃO pg_net' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
        ) THEN '✅ HABILITADA'
        ELSE '❌ NÃO HABILITADA - Execute: CREATE EXTENSION IF NOT EXISTS pg_net;'
    END as status;

-- 3. LISTAR TODOS OS CRON JOBS DE SYNC
SELECT 
    '3. CRON JOBS DE SYNC' as verificacao,
    jobid,
    jobname,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobid as job_id,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END as status_descricao
FROM cron.job
WHERE jobname LIKE '%sync%'
ORDER BY jobname;

-- 4. VERIFICAR ÚLTIMAS EXECUÇÕES DOS CRON JOBS (últimas 50)
SELECT 
    '4. ÚLTIMAS EXECUÇÕES' as verificacao,
    j.jobname,
    jrd.start_time,
    jrd.end_time,
    jrd.status,
    jrd.return_message,
    EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duracao_segundos,
    CASE 
        WHEN jrd.status = 'succeeded' THEN '✅ SUCESSO'
        WHEN jrd.status = 'failed' THEN '❌ FALHOU'
        WHEN jrd.status = 'running' THEN '🔄 EM EXECUÇÃO'
        ELSE '⚠️ ' || jrd.status
    END as status_descricao
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
ORDER BY jrd.start_time DESC NULLS LAST
LIMIT 50;

-- 5. VERIFICAR SE A FUNÇÃO chamar_sync_tiny_orders EXISTE E ESTÁ CORRETA
SELECT 
    '5. FUNÇÃO chamar_sync_tiny_orders' as verificacao,
    p.proname as nome_funcao,
    n.nspname as schema,
    pg_get_functiondef(p.oid) as definicao_funcao
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
  AND p.proname = 'chamar_sync_tiny_orders';

-- 6. VERIFICAR CONFIGURAÇÕES NECESSÁRIAS
SELECT 
    '6. CONFIGURAÇÕES' as verificacao,
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ CONFIGURADO'
        ELSE '❌ NÃO CONFIGURADO'
    END as status,
    CASE 
        WHEN key = 'supabase_service_role_key' THEN '***OCULTO***'
        ELSE LEFT(value, 50)
    END as valor_preview
FROM sistemaretiradas.app_config
WHERE key IN ('supabase_url', 'supabase_service_role_key')
ORDER BY key;

-- 7. VERIFICAR SE A EDGE FUNCTION sync-tiny-orders EXISTE
-- (Isso precisa ser verificado manualmente no Supabase Dashboard)
SELECT 
    '7. EDGE FUNCTION' as verificacao,
    'Verifique manualmente no Supabase Dashboard se a função sync-tiny-orders existe e está deployada' as instrucao;

-- 8. CONTAR EXECUÇÕES POR STATUS (últimas 24h)
SELECT 
    '8. ESTATÍSTICAS (24h)' as verificacao,
    j.jobname,
    COUNT(*) as total_execucoes,
    COUNT(*) FILTER (WHERE jrd.status = 'succeeded') as sucessos,
    COUNT(*) FILTER (WHERE jrd.status = 'failed') as falhas,
    COUNT(*) FILTER (WHERE jrd.status = 'running') as em_execucao,
    MAX(jrd.start_time) as ultima_execucao
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
  AND (jrd.start_time >= NOW() - INTERVAL '24 hours' OR jrd.start_time IS NULL)
GROUP BY j.jobname
ORDER BY j.jobname;

-- 9. VERIFICAR ERROS RECENTES
SELECT 
    '9. ERROS RECENTES' as verificacao,
    j.jobname,
    jrd.start_time,
    jrd.return_message,
    jrd.status
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
  AND jrd.status = 'failed'
  AND jrd.start_time >= NOW() - INTERVAL '24 hours'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 10. TESTAR A FUNÇÃO MANUALMENTE (OPCIONAL - DESCOMENTE PARA TESTAR)
-- SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');

-- ============================================================================
-- AÇÕES RECOMENDADAS
-- ============================================================================
SELECT 
    'AÇÕES RECOMENDADAS' as verificacao,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN 
            '1. Execute: CREATE EXTENSION IF NOT EXISTS pg_cron;'
        WHEN NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN 
            '2. Execute: CREATE EXTENSION IF NOT EXISTS pg_net;'
        WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname LIKE '%sync%' AND NOT active) THEN 
            '3. Reative os cron jobs inativos executando REATIVAR_SYNC_ERP.sql'
        WHEN NOT EXISTS (SELECT 1 FROM sistemaretiradas.app_config WHERE key = 'supabase_service_role_key' AND value IS NOT NULL) THEN 
            '4. Configure a service_role_key na tabela app_config'
        ELSE 
            '5. Verifique os logs da Edge Function sync-tiny-orders no Supabase Dashboard'
    END as acao_prioritaria;

