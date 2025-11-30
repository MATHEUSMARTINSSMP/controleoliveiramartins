-- ============================================================================
-- DIAGNOSTICAR ENVIOS REAIS - VERIFICAR O QUE REALMENTE ACONTECEU
-- ============================================================================

-- ============================================================================
-- 1. TODAS AS MENSAGENS NA FILA (TODOS OS STATUS)
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.status,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    q.transaction_id,
    q.cliente_id,
    q.store_id,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
ORDER BY q.created_at DESC;

-- ============================================================================
-- 2. VERIFICAR MENSAGENS COM STATUS "SENT" - DETALHADO
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.status,
    q.last_attempt_at as enviado_em,
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    CASE 
        WHEN c.telefone IS NULL OR c.telefone = '' THEN 'SEM TELEFONE'
        ELSE c.telefone
    END as telefone_status,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    ct.tiny_order_id,
    ped.numero_pedido
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
LEFT JOIN sistemaretiradas.tiny_orders ped ON ped.id = ct.tiny_order_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC;

-- ============================================================================
-- 3. VERIFICAR CLIENTES SEM TELEFONE (QUE PODEM TER CAUSADO PROBLEMAS)
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.status,
    q.error_message,
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
WHERE (c.telefone IS NULL OR c.telefone = '' OR TRIM(c.telefone) = '')
ORDER BY q.created_at DESC;

-- ============================================================================
-- 4. VERIFICAR MENSAGENS QUE FALHARAM OU FORAM PULADAS
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.status,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    c.nome as cliente_nome,
    c.telefone as cliente_telefone,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
WHERE q.status IN ('FAILED', 'SKIPPED')
ORDER BY q.created_at DESC;

-- ============================================================================
-- 5. VERIFICAR SE HÁ CLIENTES COM TELEFONE INVÁLIDO OU MAL FORMATADO
-- ============================================================================

SELECT 
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    LENGTH(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) as tamanho_numeros,
    REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') as telefone_apenas_numeros,
    COUNT(q.id) as total_mensagens_na_fila
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE c.telefone IS NOT NULL 
  AND c.telefone != ''
GROUP BY c.id, c.nome, c.telefone
HAVING LENGTH(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) < 10
   OR LENGTH(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) > 15
ORDER BY total_mensagens_na_fila DESC;

-- ============================================================================
-- 6. VERIFICAR TODOS OS CLIENTES QUE ESTÃO NA FILA (COM E SEM TELEFONE)
-- ============================================================================

SELECT 
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    CASE 
        WHEN c.telefone IS NULL OR c.telefone = '' OR TRIM(c.telefone) = '' 
        THEN 'SEM TELEFONE'
        WHEN LENGTH(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) < 10
        THEN 'TELEFONE MUITO CURTO'
        ELSE 'TEM TELEFONE'
    END as status_telefone,
    COUNT(q.id) as total_na_fila,
    COUNT(q.id) FILTER (WHERE q.status = 'SENT') as enviadas,
    COUNT(q.id) FILTER (WHERE q.status = 'PENDING') as pendentes,
    COUNT(q.id) FILTER (WHERE q.status = 'FAILED') as falhadas,
    COUNT(q.id) FILTER (WHERE q.status = 'SKIPPED') as puladas
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
GROUP BY c.id, c.nome, c.telefone
ORDER BY total_na_fila DESC;

