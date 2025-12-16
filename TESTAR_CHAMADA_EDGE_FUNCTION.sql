-- ============================================================================
-- TESTAR CHAMADA DA EDGE FUNCTION E VERIFICAR RESULTADO
-- ============================================================================
-- Este script testa a chamada da Edge Function e verifica se ela está sendo
-- executada corretamente, mesmo que o cron job esteja retornando sucesso
-- ============================================================================

-- ============================================================================
-- PASSO 1: Verificar itens pendentes na fila ANTES do teste
-- ============================================================================
SELECT 
    'ANTES: Itens pendentes na fila' as etapa,
    COUNT(*) as total_pendentes,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.cashback_whatsapp_queue;

-- ============================================================================
-- PASSO 2: Chamar a função manualmente e capturar o request_id
-- ============================================================================
DO $$
DECLARE
    request_id bigint;
    test_start_time timestamp;
BEGIN
    test_start_time := NOW();
    
    RAISE NOTICE '🔄 Iniciando teste de chamada da Edge Function...';
    RAISE NOTICE '⏰ Hora do teste: %', test_start_time;
    
    -- Chamar a função que o cron job chama
    PERFORM sistemaretiradas.chamar_process_cashback_queue();
    
    RAISE NOTICE '✅ Função chamar_process_cashback_queue() executada';
    RAISE NOTICE '⏳ Aguarde 10-15 segundos para a requisição HTTP ser processada...';
    RAISE NOTICE '📋 Execute a query abaixo para verificar o resultado:';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT * FROM net.http_request_queue WHERE created > ''%'' ORDER BY created DESC LIMIT 5;', test_start_time;
END;
$$;

-- ============================================================================
-- PASSO 3: Verificar se a requisição HTTP foi criada
-- ============================================================================
-- Execute esta query 10-15 segundos após executar o PASSO 2
SELECT 
    'Verificação: Requisição HTTP criada' as verificacao,
    id,
    method,
    url,
    status_code,
    error_msg,
    created,
    started_at,
    finished_at,
    CASE 
        WHEN status_code IS NULL AND error_msg IS NULL THEN '⏳ Ainda processando...'
        WHEN status_code >= 200 AND status_code < 300 THEN '✅ Sucesso!'
        WHEN status_code >= 400 THEN '❌ Erro HTTP: ' || status_code
        WHEN error_msg IS NOT NULL THEN '❌ Erro: ' || error_msg
        ELSE '⚠️ Status desconhecido'
    END as status
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
ORDER BY created DESC
LIMIT 5;

-- ============================================================================
-- PASSO 4: Verificar se itens foram processados na fila
-- ============================================================================
SELECT 
    'DEPOIS: Status da fila após teste' as etapa,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
    COUNT(*) FILTER (WHERE status = 'SKIPPED') as skipped,
    MAX(updated_at) as ultima_atualizacao
FROM sistemaretiradas.cashback_whatsapp_queue;

-- ============================================================================
-- PASSO 5: Verificar logs detalhados da última requisição
-- ============================================================================
SELECT 
    'Logs da última requisição' as verificacao,
    id,
    url,
    status_code,
    error_msg,
    request_headers,
    response_headers,
    content,
    created,
    started_at,
    finished_at,
    EXTRACT(EPOCH FROM (finished_at - started_at)) as duracao_segundos
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
ORDER BY created DESC
LIMIT 1;

-- ============================================================================
-- DIAGNÓSTICO: Comparar comportamento do cron vs manual
-- ============================================================================
SELECT 
    'Comparação: Cron vs Manual' as verificacao,
    'Cron Job' as tipo,
    COUNT(*) as total_execucoes,
    COUNT(*) FILTER (WHERE status = 'succeeded') as sucessos,
    COUNT(*) FILTER (WHERE status = 'failed') as falhas,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as tempo_medio_segundos
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-cashback-queue')
  AND start_time > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'Comparação: Cron vs Manual' as verificacao,
    'Requisições HTTP' as tipo,
    COUNT(*) as total_execucoes,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as sucessos,
    COUNT(*) FILTER (WHERE status_code >= 400 OR error_msg IS NOT NULL) as falhas,
    AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as tempo_medio_segundos
FROM net.http_request_queue
WHERE url LIKE '%process-cashback-queue%'
  AND created > NOW() - INTERVAL '1 hour';

