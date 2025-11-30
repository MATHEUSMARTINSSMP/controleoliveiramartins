-- ============================================================================
-- VERIFICAR FILA DE WHATSAPP DE CASHBACK
-- ============================================================================
-- Script para verificar status das mensagens na fila
-- ============================================================================

-- ============================================================================
-- 1. RESUMO GERAL DA FILA
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total,
    STRING_AGG(id::TEXT, ', ' ORDER BY created_at ASC) as ids
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'SENT' THEN 3
        WHEN 'SKIPPED' THEN 4
        WHEN 'FAILED' THEN 5
        ELSE 6
    END;

-- ============================================================================
-- 2. MENSAGENS PENDENTES (detalhado)
-- ============================================================================

SELECT 
    q.id,
    q.transaction_id,
    q.cliente_id,
    q.store_id,
    q.status,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC;

-- ============================================================================
-- 3. TODAS AS MENSAGENS (últimas 50)
-- ============================================================================

SELECT 
    q.id,
    q.status,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    c.nome as cliente_nome,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
ORDER BY q.created_at DESC
LIMIT 50;

-- ============================================================================
-- 4. MENSAGENS FALHADAS (requer atenção)
-- ============================================================================

SELECT 
    q.id,
    q.transaction_id,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'FAILED'
ORDER BY q.created_at DESC;

-- ============================================================================
-- 5. MENSAGENS ENVIADAS COM SUCESSO (últimas 20)
-- ============================================================================

SELECT 
    q.id,
    q.created_at as criado_em,
    q.last_attempt_at as enviado_em,
    c.nome as cliente_nome,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 20;

-- ============================================================================
-- 6. MENSAGENS PULADAS (sem telefone, etc.)
-- ============================================================================

SELECT 
    q.id,
    q.error_message as motivo,
    q.created_at as criado_em,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SKIPPED'
ORDER BY q.created_at DESC;

-- ============================================================================
-- 7. ESTATÍSTICAS GERAIS
-- ============================================================================

SELECT 
    COUNT(*) as total_mensagens,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pendentes,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processando,
    COUNT(*) FILTER (WHERE status = 'SENT') as enviadas,
    COUNT(*) FILTER (WHERE status = 'SKIPPED') as puladas,
    COUNT(*) FILTER (WHERE status = 'FAILED') as falhadas,
    AVG(attempts) as media_tentativas,
    MIN(created_at) as mensagem_mais_antiga,
    MAX(created_at) as mensagem_mais_recente
FROM sistemaretiradas.cashback_whatsapp_queue;

