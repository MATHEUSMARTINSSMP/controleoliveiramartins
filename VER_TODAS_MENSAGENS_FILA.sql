-- ============================================================================
-- QUERY: Ver TODAS as Mensagens da Fila (Todos os Status)
-- Descrição: Mostra todas as mensagens independente do status
-- ============================================================================

-- ============================================================================
-- 1. TODAS AS MENSAGENS (Últimas 24 horas)
-- ============================================================================

SELECT 
    q.id,
    q.status,
    CASE q.status
        WHEN 'PENDING' THEN '⏳ PENDENTE'
        WHEN 'PROCESSING' THEN '🔄 PROCESSANDO'
        WHEN 'SENT' THEN '✅ ENVIADA'
        WHEN 'FAILED' THEN '❌ FALHOU'
        WHEN 'SKIPPED' THEN '⏭️ PULADA'
        ELSE q.status
    END as status_formatado,
    q.attempts as tentativas,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_acao,
    CASE 
        WHEN q.status = 'PENDING' THEN EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER
        WHEN q.last_attempt_at IS NOT NULL THEN EXTRACT(EPOCH FROM (q.last_attempt_at - q.created_at))::INTEGER
        ELSE NULL
    END as tempo_total_segundos,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    q.error_message as erro
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC;

-- ============================================================================
-- 2. MENSAGENS CRIADAS HOJE (Todos os status)
-- ============================================================================

SELECT 
    q.id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_acao,
    q.error_message as erro,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.created_at::date = CURRENT_DATE
ORDER BY q.created_at DESC;

-- ============================================================================
-- 3. VERIFICAR MENSAGENS ESPECÍFICAS (Pelas horas que você mencionou)
-- ============================================================================

-- Mensagens criadas entre 19:00 e 20:00 (horário que você mencionou)
SELECT 
    q.id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_acao,
    q.error_message as erro,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.created_at >= '2025-11-30 19:00:00'::timestamp
  AND q.created_at < '2025-11-30 20:00:00'::timestamp
ORDER BY q.created_at DESC;

-- ============================================================================
-- 4. RESUMO POR STATUS (Últimas 24 horas)
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total,
    STRING_AGG(DISTINCT TO_CHAR(created_at, 'HH24:MI:SS'), ', ' ORDER BY TO_CHAR(created_at, 'HH24:MI:SS')) as horarios
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'SENT' THEN 3
        WHEN 'SKIPPED' THEN 4
        WHEN 'FAILED' THEN 5
    END;

-- ============================================================================
-- 5. MENSAGENS QUE PODEM TER SIDO PROCESSADAS RECENTEMENTE
-- ============================================================================

SELECT 
    q.id,
    q.status,
    q.created_at as criado_em,
    q.last_attempt_at as processado_em,
    q.attempts as tentativas,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    q.error_message as erro
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.created_at >= '2025-11-30 18:00:00'::timestamp
ORDER BY q.last_attempt_at DESC NULLS LAST, q.created_at DESC;

