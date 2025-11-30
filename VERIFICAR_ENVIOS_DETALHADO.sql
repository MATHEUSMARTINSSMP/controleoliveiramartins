-- ============================================================================
-- VERIFICAR ENVIOS DETALHADO - COMPARAR COM WEBHOOK N8N
-- ============================================================================
-- Esta query mostra exatamente o que foi enviado e quando
-- Use para comparar com os logs do webhook n8n
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.status,
    q.created_at as adicionado_na_fila_em,
    q.last_attempt_at as enviado_em,
    q.attempts as tentativas,
    q.error_message as erro,
    
    -- Dados do cliente
    c.nome as cliente_nome,
    c.telefone as telefone_original_banco,
    -- Simular normalização (mesma lógica do código)
    '55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    ) as numero_enviado_whatsapp,
    
    -- Dados da transação
    ct.amount as valor_cashback,
    ct.data_expiracao,
    
    -- Dados do pedido
    ped.numero_pedido,
    ped.data_pedido,
    
    -- Dados da loja
    s.name as loja_nome
    
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
LEFT JOIN sistemaretiradas.tiny_orders ped ON ped.id = ct.tiny_order_id
ORDER BY q.last_attempt_at DESC NULLS LAST, q.created_at DESC;

-- ============================================================================
-- RESUMO: NÚMEROS QUE FORAM ENVIADOS (FORMATO FINAL)
-- ============================================================================

SELECT 
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    '55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    ) as numero_enviado_whatsapp,
    COUNT(q.id) as total_envios,
    STRING_AGG(TO_CHAR(q.last_attempt_at, 'DD/MM/YYYY HH24:MI:SS'), ', ' ORDER BY q.last_attempt_at DESC) as datas_envios
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
  AND c.telefone IS NOT NULL
GROUP BY c.nome, c.telefone
ORDER BY MAX(q.last_attempt_at) DESC;

