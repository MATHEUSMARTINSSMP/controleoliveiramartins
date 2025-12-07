-- ============================================================================
-- CORREÇÃO: ERP não está atualizando após mudança de mês
-- Execute este script para diagnosticar e corrigir
-- ============================================================================

-- 1. VERIFICAR ÚLTIMOS PEDIDOS DO TINY (últimas 48h)
SELECT 
    '1. ÚLTIMOS PEDIDOS TINY (48h)' as verificacao,
    t_order.numero_pedido,
    t_order.data_pedido,
    t_order.valor_total,
    t_order.created_at as sincronizado_em,
    CASE 
        WHEN s.id IS NOT NULL THEN '✅ TEM VENDA'
        ELSE '❌ SEM VENDA'
    END as status_venda,
    EXTRACT(DAY FROM t_order.data_pedido) as dia_pedido,
    EXTRACT(MONTH FROM t_order.data_pedido) as mes_pedido,
    EXTRACT(YEAR FROM t_order.data_pedido) as ano_pedido
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE t_order.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY t_order.created_at DESC
LIMIT 20;

-- 2. VERIFICAR PEDIDOS DO MÊS ATUAL QUE NÃO TÊM VENDA
SELECT 
    '2. PEDIDOS DO MÊS ATUAL SEM VENDA' as verificacao,
    COUNT(*) as total_sem_venda,
    MIN(t_order.data_pedido) as primeira_data,
    MAX(t_order.data_pedido) as ultima_data
FROM sistemaretiradas.tiny_orders t_order
LEFT JOIN sistemaretiradas.sales s ON s.tiny_order_id = t_order.id
WHERE s.id IS NULL
  AND t_order.valor_total > 0
  AND EXTRACT(MONTH FROM t_order.data_pedido) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM t_order.data_pedido) = EXTRACT(YEAR FROM CURRENT_DATE);

-- 3. VERIFICAR ÚLTIMO NÚMERO DE PEDIDO CONHECIDO POR LOJA
SELECT 
    '3. ÚLTIMO NÚMERO CONHECIDO POR LOJA' as verificacao,
    s.name as loja,
    t_order.store_id,
    MAX(t_order.numero_pedido::INTEGER) as ultimo_numero,
    MAX(t_order.data_pedido) as ultima_data_pedido,
    COUNT(*) as total_pedidos
FROM sistemaretiradas.tiny_orders t_order
JOIN sistemaretiradas.stores s ON s.id = t_order.store_id
GROUP BY s.name, t_order.store_id
ORDER BY ultimo_numero DESC;

-- 4. FORÇAR CRIAÇÃO DE VENDAS PARA PEDIDOS SEM VENDA DO MÊS ATUAL
-- ⚠️ ATENÇÃO: Execute apenas se necessário
DO $$
DECLARE
    v_resultado JSONB;
BEGIN
    -- Chamar função para criar vendas
    SELECT * INTO v_resultado
    FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);
    
    RAISE NOTICE 'Resultado: %', v_resultado;
END $$;

-- 5. VERIFICAR CRON JOBS
SELECT 
    '5. STATUS DOS CRON JOBS' as verificacao,
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN active THEN '✅ ATIVO'
        ELSE '❌ INATIVO - REATIVE!'
    END as status
FROM cron.job
WHERE jobname LIKE '%sync%'
ORDER BY jobname;

-- 6. VERIFICAR ÚLTIMAS EXECUÇÕES DOS CRON JOBS (últimas 24h)
SELECT 
    '6. ÚLTIMAS EXECUÇÕES (24h)' as verificacao,
    j.jobname,
    jrd.start_time,
    jrd.end_time,
    jrd.status,
    LEFT(jrd.return_message, 200) as mensagem,
    CASE 
        WHEN jrd.status = 'succeeded' THEN '✅ SUCESSO'
        WHEN jrd.status = 'failed' THEN '❌ FALHOU'
        ELSE '⚠️ ' || jrd.status
    END as status_descricao
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%sync%'
  AND jrd.start_time >= NOW() - INTERVAL '24 hours'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- 7. TESTAR SINCRONIZAÇÃO MANUAL (OPCIONAL - DESCOMENTE PARA TESTAR)
-- SELECT sistemaretiradas.chamar_sync_tiny_orders('incremental_1min');

-- ============================================================================
-- AÇÕES RECOMENDADAS:
-- 1. Se há pedidos sem venda, execute o passo 4
-- 2. Se cron jobs estão inativos, execute REATIVAR_SYNC_ERP.sql
-- 3. Se último número conhecido está desatualizado, pode ser necessário fazer hard sync
-- ============================================================================

