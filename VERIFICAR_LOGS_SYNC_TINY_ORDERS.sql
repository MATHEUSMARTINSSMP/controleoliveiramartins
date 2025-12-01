-- ============================================================================
-- VERIFICAR LOGS DE SINCRONIZAÇÃO DO TINY ERP
-- ============================================================================
-- Este script verifica se as sincronizações estão realmente sendo executadas
-- e se estão puxando dados

-- 1. Verificar últimas execuções do cron job (últimas 10 execuções)
SELECT 
    j.jobname,
    jrd.runid,
    jrd.status,
    jrd.return_message,
    jrd.start_time,
    jrd.end_time,
    EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))::NUMERIC(10,3) AS duracao_segundos,
    jrd.status_message
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'sync-incremental-1min'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- 2. Verificar logs de sincronização salvos no banco (tabela erp_sync_logs)
-- Nota: Esta tabela pode ter um nome diferente, verifique o nome correto
SELECT 
    store_id,
    stores.name AS loja,
    tipo_sync,
    registros_sincronizados,
    registros_com_erro,
    sucesso,
    created_at AS data_execucao,
    EXTRACT(EPOCH FROM (NOW() - created_at))::NUMEGER / 60 AS minutos_atras
FROM sistemaretiradas.erp_sync_logs
JOIN sistemaretiradas.stores ON stores.id = erp_sync_logs.store_id
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Verificar última venda sincronizada de cada loja
SELECT 
    to2.store_id,
    stores.name AS loja,
    MAX(to2.numero_pedido) AS ultimo_numero_pedido,
    MAX(to2.data_pedido) AS ultima_data_pedido,
    MAX(to2.created_at) AS ultima_sincronizacao,
    COUNT(*) AS total_pedidos_loja
FROM sistemaretiradas.tiny_orders to2
JOIN sistemaretiradas.stores ON stores.id = to2.store_id
GROUP BY to2.store_id, stores.name
ORDER BY stores.name;

-- 4. Verificar se há pedidos novos no Tiny que não foram sincronizados
-- (Esta query verifica pedidos criados nas últimas 2 horas)
-- Nota: Esta é uma verificação manual, pois não temos acesso direto à API Tiny aqui
SELECT 
    COUNT(*) AS pedidos_sincronizados_ultimas_2h,
    MAX(created_at) AS ultima_sincronizacao
FROM sistemaretiradas.tiny_orders
WHERE created_at >= NOW() - INTERVAL '2 hours';

-- 5. Verificar integrações ativas configuradas
SELECT 
    erp_configs.store_id,
    stores.name AS loja,
    erp_configs.sincronizacao_ativa,
    erp_configs.tiny_api_key IS NOT NULL AS tem_api_key,
    erp_configs.tiny_api_token IS NOT NULL AS tem_api_token,
    erp_configs.updated_at AS ultima_atualizacao_config
FROM sistemaretiradas.erp_configs
JOIN sistemaretiradas.stores ON stores.id = erp_configs.store_id
WHERE erp_configs.sincronizacao_ativa = true
ORDER BY stores.name;

-- 6. Verificar se há pedidos sendo criados na tabela sales a partir de tiny_orders
SELECT 
    COUNT(*) AS total_sales,
    COUNT(DISTINCT s.tiny_order_id) AS sales_com_tiny_order_id,
    MAX(s.created_at) AS ultima_sale_criada
FROM sistemaretiradas.sales s
WHERE s.tiny_order_id IS NOT NULL
    AND s.created_at >= NOW() - INTERVAL '24 hours';

-- 7. Verificar se o pooling inteligente está detectando novas vendas
-- Comparar último pedido no banco vs data atual
SELECT 
    store_id,
    stores.name AS loja,
    MAX(numero_pedido) AS ultimo_numero_pedido,
    MAX(data_pedido) AS ultima_data_pedido,
    MAX(updated_at) AS ultima_atualizacao,
    EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))::INTEGER / 60 AS minutos_sem_atualizacao
FROM sistemaretiradas.tiny_orders
JOIN sistemaretiradas.stores ON stores.id = tiny_orders.store_id
GROUP BY store_id, stores.name
ORDER BY stores.name;

