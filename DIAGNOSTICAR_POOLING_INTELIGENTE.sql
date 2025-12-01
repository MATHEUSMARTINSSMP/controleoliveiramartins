-- ============================================================================
-- DIAGNÓSTICO: Pooling Inteligente Não Está Funcionando
-- ============================================================================
-- Este script verifica se o pooling inteligente está configurado corretamente

-- 1. Verificar se pg_cron está habilitado
SELECT 
    extname AS extensao,
    extversion AS versao
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net', 'http');

-- 2. Verificar se os cron jobs estão agendados
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
    jobid::text || '-' || jobname AS job_full
FROM cron.job
WHERE jobname LIKE '%sync%'
ORDER BY jobname;

-- 3. Verificar execuções recentes dos cron jobs (últimas 24h)
SELECT 
    j.jobid,
    j.jobname,
    jrd.jobid AS run_jobid,
    jrd.runid,
    jrd.status,
    jrd.return_message,
    jrd.start_time,
    jrd.end_time,
    CASE 
        WHEN jrd.end_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))::INTEGER
        ELSE NULL
    END AS duracao_segundos,
    jrd.start_time::DATE AS data_execucao
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
    AND jrd.start_time >= NOW() - INTERVAL '24 hours'
ORDER BY jrd.start_time DESC
LIMIT 50;

-- 4. Verificar se a função chamar_sync_tiny_orders existe
SELECT 
    p.proname AS nome_funcao,
    pg_get_function_arguments(p.oid) AS argumentos,
    pg_get_functiondef(p.oid) AS definicao_completa
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
    AND p.proname LIKE '%sync%'
ORDER BY p.proname;

-- 5. Verificar configurações no app_config
SELECT 
    key,
    CASE 
        WHEN key LIKE '%key%' OR key LIKE '%secret%' THEN '***OCULTO***'
        ELSE value
    END AS value,
    description,
    updated_at
FROM sistemaretiradas.app_config
WHERE key LIKE '%supabase%'
ORDER BY key;

-- 6. Verificar última sincronização bem-sucedida
SELECT 
    store_id,
    stores.name AS loja,
    tipo_sync,
    registros_sincronizados,
    registros_atualizados,
    registros_com_erro,
    sucesso,
    mensagem,
    created_at AS data_execucao,
    EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 60 AS minutos_atras
FROM sistemaretiradas.erp_sync_logs
JOIN sistemaretiradas.stores ON stores.id = erp_sync_logs.store_id
WHERE sucesso = true
    AND tipo_sync = 'incremental_1min'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Verificar erros recentes na sincronização
SELECT 
    store_id,
    stores.name AS loja,
    tipo_sync,
    mensagem,
    created_at AS data_execucao,
    EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 60 AS minutos_atras
FROM sistemaretiradas.erp_sync_logs
JOIN sistemaretiradas.stores ON stores.id = erp_sync_logs.store_id
WHERE sucesso = false
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 8. Verificar se há integrações ativas configuradas
SELECT 
    erp_configs.store_id,
    stores.name AS loja,
    erp_configs.tiny_api_key IS NOT NULL AS tem_api_key,
    erp_configs.tiny_api_token IS NOT NULL AS tem_api_token,
    erp_configs.sincronizacao_ativa AS sincronizacao_ativa,
    erp_configs.updated_at AS ultima_atualizacao
FROM sistemaretiradas.erp_configs
JOIN sistemaretiradas.stores ON stores.id = erp_configs.store_id
WHERE erp_configs.sincronizacao_ativa = true
ORDER BY stores.name;

-- 9. Verificar última venda sincronizada de cada loja
SELECT 
    store_id,
    stores.name AS loja,
    MAX(numero_pedido) AS ultimo_numero_pedido,
    MAX(data_pedido) AS ultima_data_pedido,
    MAX(updated_at) AS ultima_atualizacao,
    COUNT(*) AS total_pedidos
FROM sistemaretiradas.tiny_orders
JOIN sistemaretiradas.stores ON stores.id = tiny_orders.store_id
GROUP BY store_id, stores.name
ORDER BY stores.name;

-- 10. Testar se pg_net está funcionando (fazer uma requisição HTTP simples)
DO $$
DECLARE
    request_id BIGINT;
    test_url TEXT := 'https://httpbin.org/get';
BEGIN
    -- Tentar fazer uma requisição HTTP de teste
    BEGIN
        SELECT net.http_get(url := test_url) INTO request_id;
        RAISE NOTICE '✅ pg_net está funcionando! Request ID: %', request_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ pg_net não está funcionando ou não está disponível: %', SQLERRM;
        
        -- Tentar verificar se a extensão está instalada
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            RAISE NOTICE 'ℹ️ A extensão pg_net está instalada, mas pode não estar configurada corretamente.';
        ELSE
            RAISE WARNING '❌ A extensão pg_net NÃO está instalada. Execute: CREATE EXTENSION IF NOT EXISTS pg_net;';
        END IF;
    END;
END $$;

