-- ============================================================================
-- QUERY: Verificar Mensagens Pendentes na Fila de WhatsApp
-- Descrição: Mostra mensagens pendentes e tempo na fila
-- ============================================================================

-- ============================================================================
-- 1. RESUMO RÁPIDO (Estatísticas)
-- ============================================================================

SELECT 
    '📊 RESUMO DA FILA' as titulo,
    COUNT(*) as total_pendentes,
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '10 minutes' THEN 1 END) as pendentes_mais_10min,
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '5 minutes' THEN 1 END) as pendentes_mais_5min,
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '2 minutes' THEN 1 END) as pendentes_mais_2min,
    MIN(created_at) as mensagem_mais_antiga,
    EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INTEGER as segundos_da_mais_antiga,
    CASE 
        WHEN MIN(created_at) < NOW() - INTERVAL '10 minutes' THEN '🔴 CRÍTICO'
        WHEN MIN(created_at) < NOW() - INTERVAL '5 minutes' THEN '🟠 ATENÇÃO'
        WHEN MIN(created_at) < NOW() - INTERVAL '2 minutes' THEN '🟡 MONITORAR'
        ELSE '🟢 OK'
    END as status_geral
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';

-- ============================================================================
-- 2. LISTA DETALHADA DE PENDENTES
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER as segundos_na_fila,
    CASE 
        WHEN NOW() - q.created_at > INTERVAL '10 minutes' THEN '🔴 CRÍTICO (>10min)'
        WHEN NOW() - q.created_at > INTERVAL '5 minutes' THEN '🟠 ATENÇÃO (>5min)'
        WHEN NOW() - q.created_at > INTERVAL '2 minutes' THEN '🟡 LONGO (>2min)'
        ELSE '🟢 NORMAL'
    END as prioridade,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    q.error_message as ultimo_erro
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC;

-- ============================================================================
-- 3. ESTATÍSTICAS POR STATUS (Últimas 24 horas)
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as ultima_hora,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as ultimas_24h
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'SENT' THEN 3
        WHEN 'FAILED' THEN 4
        WHEN 'SKIPPED' THEN 5
    END;

-- ============================================================================
-- 4. ÚLTIMAS MENSAGENS ENVIADAS (Verificar se está funcionando)
-- ============================================================================

SELECT 
    q.id,
    q.status,
    q.created_at as criado_em,
    q.last_attempt_at as enviado_em,
    EXTRACT(EPOCH FROM (q.last_attempt_at - q.created_at))::INTEGER as segundos_ate_envio,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 10;

