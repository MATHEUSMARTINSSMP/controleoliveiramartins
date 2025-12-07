-- ============================================================================
-- DIAGNÓSTICO: Por que o ERP não está atualizando o Dashboard da Loja?
-- Execute este script no Supabase SQL Editor para diagnosticar o problema
-- ============================================================================

-- 1. VERIFICAR SE OS CRON JOBS ESTÃO ATIVOS
SELECT 
    '1. CRON JOBS' as verificacao,
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO'
    END as status
FROM cron.job
WHERE jobname LIKE '%sync%'
ORDER BY jobname;

-- 2. VERIFICAR ÚLTIMAS EXECUÇÕES DOS CRON JOBS
SELECT 
    '2. ÚLTIMAS EXECUÇÕES' as verificacao,
    j.jobname,
    jrd.start_time,
    jrd.end_time,
    jrd.status,
    jrd.return_message,
    CASE 
        WHEN jrd.status = 'succeeded' THEN '✅ SUCESSO'
        WHEN jrd.status = 'failed' THEN '❌ FALHOU'
        ELSE '⚠️ ' || jrd.status
    END as status_descricao
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 3. VERIFICAR SE A FUNÇÃO criar_vendas_de_tiny_orders EXISTE
SELECT 
    '3. FUNÇÃO criar_vendas_de_tiny_orders' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'sistemaretiradas'
            AND p.proname = 'criar_vendas_de_tiny_orders'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status;

-- 4. VERIFICAR PEDIDOS DO TINY QUE NÃO TÊM VENDA CRIADA
SELECT 
    '4. PEDIDOS SEM VENDA' as verificacao,
    COUNT(*) as total_pedidos_sem_venda,
    SUM(CASE WHEN valor_total > 0 THEN 1 ELSE 0 END) as pedidos_com_valor_sem_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.valor_total > 0
  AND t_order.data_pedido >= CURRENT_DATE - INTERVAL '7 days';

-- 5. VERIFICAR PEDIDOS RECENTES DO TINY (últimas 24h)
SELECT 
    '5. PEDIDOS RECENTES (24h)' as verificacao,
    COUNT(*) as total_pedidos,
    COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN t_order.id END) as pedidos_com_venda,
    COUNT(DISTINCT CASE WHEN s.id IS NULL AND t_order.valor_total > 0 THEN t_order.id END) as pedidos_sem_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '24 hours';

-- 6. VERIFICAR CONFIGURAÇÕES NECESSÁRIAS
SELECT 
    '6. CONFIGURAÇÕES' as verificacao,
    key,
    CASE 
        WHEN value IS NOT NULL AND value != '' THEN '✅ CONFIGURADO'
        ELSE '❌ NÃO CONFIGURADO'
    END as status
FROM sistemaretiradas.app_config
WHERE key IN ('supabase_url', 'supabase_service_role_key')
ORDER BY key;

-- 7. VERIFICAR SE A FUNÇÃO chamar_sync_tiny_orders EXISTE
SELECT 
    '7. FUNÇÃO chamar_sync_tiny_orders' as verificacao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'sistemaretiradas'
            AND p.proname = 'chamar_sync_tiny_orders'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status;

-- 8. VERIFICAR ÚLTIMOS PEDIDOS SINCRONIZADOS
SELECT 
    '8. ÚLTIMOS PEDIDOS SINCRONIZADOS' as verificacao,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.created_at as sincronizado_em,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ TEM VENDA'
        ELSE '❌ SEM VENDA'
    END as status_venda
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
ORDER BY t_order.created_at DESC
LIMIT 10;

-- 9. TESTAR CRIAÇÃO DE VENDAS MANUALMENTE (APENAS VERIFICAR, NÃO EXECUTAR)
SELECT 
    '9. TESTE MANUAL' as verificacao,
    'Execute manualmente: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);' as instrucao;

-- 10. VERIFICAR ERROS RECENTES NA TABELA tiny_orders
SELECT 
    '10. ERROS RECENTES' as verificacao,
    COUNT(*) as total_erros
FROM sistemaretiradas.tiny_orders
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND (valor_total IS NULL OR valor_total <= 0 OR colaboradora_id IS NULL);

-- ============================================================================
-- RESUMO E AÇÕES RECOMENDADAS
-- ============================================================================
SELECT 
    'RESUMO' as verificacao,
    'Verifique os resultados acima e execute as ações necessárias:' as instrucao,
    '1. Se cron jobs estão inativos, reative-os' as acao1,
    '2. Se função não existe, execute a migration' as acao2,
    '3. Se há pedidos sem venda, execute criar_vendas_de_tiny_orders manualmente' as acao3,
    '4. Verifique logs de erro dos cron jobs' as acao4;

