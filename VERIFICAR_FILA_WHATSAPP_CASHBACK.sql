-- ============================================================================
-- SCRIPT: Verificar Fila de Mensagens de WhatsApp para Cashback
-- Descrição: Queries para visualizar status e detalhes da fila de WhatsApp
-- ============================================================================

-- ============================================================================
-- 1. VISÃO GERAL DA FILA (Status e Estatísticas)
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as ultimas_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as ultimos_7dias,
    MAX(created_at) as ultimo_item
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'FAILED' THEN 3
        WHEN 'SENT' THEN 4
        WHEN 'SKIPPED' THEN 5
    END;

-- ============================================================================
-- 2. MENSAGENS PENDENTES (Próximas a serem enviadas)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.cliente_id,
    q.store_id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    q.error_message as erro,
    -- Dados do cliente
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    -- Dados da loja
    s.name as loja_nome,
    -- Dados da transação
    ct.amount as valor_cashback,
    ct.transaction_type,
    ct.data_expiracao,
    -- Calculado
    NOW() - q.created_at as tempo_na_fila
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC
LIMIT 50;

-- ============================================================================
-- 3. MENSAGENS EM PROCESSAMENTO
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.attempts as tentativas,
    q.last_attempt_at as inicio_processamento,
    NOW() - q.last_attempt_at as tempo_processando,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PROCESSING'
ORDER BY q.last_attempt_at ASC;

-- ============================================================================
-- 4. MENSAGENS QUE FALHARAM (Precisam de atenção)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.attempts as tentativas,
    q.error_message as erro,
    q.last_attempt_at as ultima_tentativa,
    q.created_at as criado_em,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    CASE 
        WHEN q.attempts >= 3 THEN '❌ MÁXIMO DE TENTATIVAS'
        ELSE '⚠️ PODE TENTAR NOVAMENTE'
    END as observacao
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'FAILED'
ORDER BY q.attempts DESC, q.last_attempt_at DESC
LIMIT 50;

-- ============================================================================
-- 5. MENSAGENS ENVIADAS COM SUCESSO (Últimas)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.attempts as tentativas,
    q.last_attempt_at as enviado_em,
    q.created_at as criado_em,
    q.last_attempt_at - q.created_at as tempo_total,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 50;

-- ============================================================================
-- 6. MENSAGENS PULADAS (SKIPPED - Cliente sem telefone, etc)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.error_message as motivo,
    q.last_attempt_at as pulado_em,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'SKIPPED'
ORDER BY q.last_attempt_at DESC
LIMIT 50;

-- ============================================================================
-- 7. DETALHES COMPLETOS DE UMA MENSAGEM ESPECÍFICA
-- ============================================================================

-- Substituir 'QUEUE_ID_AQUI' pelo ID da fila
/*
SELECT 
    q.*,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    c.email as cliente_email,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    ct.transaction_type,
    ct.data_expiracao,
    ct.created_at as cashback_gerado_em
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.id = 'QUEUE_ID_AQUI';
*/

-- ============================================================================
-- 8. ESTATÍSTICAS POR LOJA
-- ============================================================================

SELECT 
    s.name as loja,
    COUNT(*) as total_mensagens,
    COUNT(CASE WHEN q.status = 'PENDING' THEN 1 END) as pendentes,
    COUNT(CASE WHEN q.status = 'PROCESSING' THEN 1 END) as processando,
    COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
    COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhadas,
    COUNT(CASE WHEN q.status = 'SKIPPED' THEN 1 END) as puladas,
    ROUND(
        100.0 * COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) / NULLIF(COUNT(*), 0),
        2
    ) as taxa_sucesso_pct
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
GROUP BY s.id, s.name
ORDER BY total_mensagens DESC;

-- ============================================================================
-- 9. MENSAGENS PENDENTES HÁ MUITO TEMPO (Possíveis problemas)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.transaction_id,
    q.created_at as criado_em,
    NOW() - q.created_at as tempo_na_fila,
    q.attempts as tentativas,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    CASE 
        WHEN NOW() - q.created_at > INTERVAL '24 hours' THEN '🔴 CRÍTICO (>24h)'
        WHEN NOW() - q.created_at > INTERVAL '6 hours' THEN '🟠 ATENÇÃO (>6h)'
        ELSE '🟡 NORMAL'
    END as prioridade
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PENDING'
  AND q.created_at < NOW() - INTERVAL '1 hour'
ORDER BY q.created_at ASC;

-- ============================================================================
-- 10. RESUMO EXECUTIVO (Dashboard)
-- ============================================================================

SELECT 
    '📊 RESUMO DA FILA DE WHATSAPP' as titulo,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'PENDING') as pendentes,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'PROCESSING') as processando,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'SENT') as enviadas,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'FAILED') as falhadas,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'SKIPPED') as puladas,
    (SELECT COUNT(*) FROM sistemaretiradas.cashback_whatsapp_queue) as total,
    (SELECT ROUND(100.0 * COUNT(CASE WHEN status = 'SENT' THEN 1 END) / NULLIF(COUNT(*), 0), 2)
     FROM sistemaretiradas.cashback_whatsapp_queue) as taxa_sucesso_pct,
    (SELECT MAX(created_at) FROM sistemaretiradas.cashback_whatsapp_queue) as ultima_mensagem_criada,
    (SELECT MAX(last_attempt_at) FROM sistemaretiradas.cashback_whatsapp_queue WHERE status = 'SENT') as ultima_mensagem_enviada;

-- ============================================================================
-- 11. ÚLTIMAS 20 MENSAGENS (Linha do Tempo)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.status,
    CASE q.status
        WHEN 'PENDING' THEN '⏳'
        WHEN 'PROCESSING' THEN '🔄'
        WHEN 'SENT' THEN '✅'
        WHEN 'FAILED' THEN '❌'
        WHEN 'SKIPPED' THEN '⏭️'
    END as emoji_status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_acao,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    q.error_message as erro
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
ORDER BY q.created_at DESC
LIMIT 20;

