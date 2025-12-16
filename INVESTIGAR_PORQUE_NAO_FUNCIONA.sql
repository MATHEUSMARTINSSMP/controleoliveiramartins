-- ============================================================================
-- INVESTIGAR POR QUE O SISTEMA NÃO ESTÁ FUNCIONANDO AUTOMATICAMENTE
-- ============================================================================
-- Este script investiga todos os componentes do sistema automático
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE O CRON JOB ESTÁ CONFIGURADO E ATIVO
-- ============================================================================
SELECT 
    '1. Cron Job process-cashback-queue' as verificacao,
    jobid,
    jobname,
    schedule,
    active,
    command,
    nodename,
    nodeport,
    database,
    username
FROM cron.job 
WHERE jobname = 'process-cashback-queue';

-- ============================================================================
-- 2. VERIFICAR HISTÓRICO DE EXECUÇÕES DO CRON JOB
-- ============================================================================
SELECT 
    '2. Histórico de execuções do cron job' as verificacao,
    runid,
    jobid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time,
    EXTRACT(EPOCH FROM (end_time - start_time)) as duracao_segundos
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-cashback-queue')
ORDER BY start_time DESC
LIMIT 20;

-- ============================================================================
-- 3. VERIFICAR SE A FUNÇÃO chamar_process_cashback_queue EXISTE E ESTÁ CORRETA
-- ============================================================================
SELECT 
    '3. Função chamar_process_cashback_queue' as verificacao,
    p.proname as nome,
    pg_get_functiondef(p.oid) as definicao_completa
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
AND p.proname = 'chamar_process_cashback_queue';

-- ============================================================================
-- 4. VERIFICAR SE O TRIGGER QUE GERA CASHBACK ESTÁ ATIVO
-- ============================================================================
SELECT 
    '4. Trigger trg_gerar_cashback_new_sale' as verificacao,
    t.tgname as trigger_name,
    c.relname as tabela,
    t.tgenabled as enabled,
    pg_get_triggerdef(t.oid) as definicao
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
AND c.relname = 'sales'
AND t.tgname = 'trg_gerar_cashback_new_sale';

-- ============================================================================
-- 5. VERIFICAR SE A FUNÇÃO gerar_cashback_from_sale ESTÁ ADICIONANDO À FILA
-- ============================================================================
SELECT 
    '5. Função gerar_cashback_from_sale' as verificacao,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%enqueue_cashback_whatsapp%' 
        THEN '✅ Chama enqueue_cashback_whatsapp'
        ELSE '❌ NÃO chama enqueue_cashback_whatsapp'
    END as status,
    CASE 
        WHEN pg_get_functiondef(p.oid)::text LIKE '%store_id%' 
        THEN '✅ Usa store_id'
        ELSE '❌ NÃO usa store_id'
    END as usa_store_id
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'sistemaretiradas'
AND p.proname = 'gerar_cashback_from_sale';

-- ============================================================================
-- 6. VERIFICAR ÚLTIMAS VENDAS E SE GERARAM CASHBACK
-- ============================================================================
SELECT 
    '6. Últimas 10 vendas e status de cashback' as verificacao,
    s.id as sale_id,
    s.created_at as data_venda,
    s.store_id,
    st.name as nome_loja,
    s.valor,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.cashback_transactions ct 
            WHERE ct.sale_id = s.id
        ) THEN '✅ Cashback gerado'
        ELSE '❌ Cashback NÃO gerado'
    END as cashback_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.cashback_whatsapp_queue cwq
            INNER JOIN sistemaretiradas.cashback_transactions ct ON ct.id = cwq.transaction_id
            WHERE ct.sale_id = s.id
        ) THEN '✅ Na fila WhatsApp'
        ELSE '❌ NÃO está na fila WhatsApp'
    END as na_fila_whatsapp
FROM sistemaretiradas.sales s
LEFT JOIN sistemaretiradas.stores st ON st.id = s.store_id
ORDER BY s.created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. VERIFICAR SE HÁ ERROS NA TABELA DE FILA
-- ============================================================================
SELECT 
    '7. Itens com erro na fila' as verificacao,
    id,
    status,
    attempts,
    error_message,
    cliente_nome,
    store_id,
    transaction_id,
    created_at,
    last_attempt_at
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status IN ('FAILED', 'PENDING')
  AND (error_message IS NOT NULL OR attempts > 0)
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 8. VERIFICAR SE pg_cron ESTÁ REALMENTE EXECUTANDO OUTROS JOBS
-- ============================================================================
SELECT 
    '8. Todos os cron jobs configurados' as verificacao,
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END as status_ativo
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- 9. VERIFICAR ÚLTIMAS EXECUÇÕES DE QUALQUER CRON JOB
-- ============================================================================
SELECT 
    '9. Últimas execuções de cron jobs (todas)' as verificacao,
    j.jobname,
    jd.status,
    jd.return_message,
    jd.start_time,
    jd.end_time
FROM cron.job_run_details jd
JOIN cron.job j ON j.jobid = jd.jobid
ORDER BY jd.start_time DESC
LIMIT 10;

-- ============================================================================
-- 10. VERIFICAR SE A QUOTA ESTÁ BLOQUEANDO EXECUÇÕES
-- ============================================================================
-- Nota: Esta informação geralmente não está disponível via SQL
-- Mas podemos verificar se há padrão de falhas recentes
SELECT 
    '10. Análise de falhas recentes' as verificacao,
    COUNT(*) FILTER (WHERE status = 'succeeded') as sucessos,
    COUNT(*) FILTER (WHERE status = 'failed') as falhas,
    COUNT(*) FILTER (WHERE status = 'running') as em_execucao,
    MAX(start_time) as ultima_execucao
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-cashback-queue')
  AND start_time > NOW() - INTERVAL '24 hours';


