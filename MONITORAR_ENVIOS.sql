-- ============================================================================
-- MONITORAR ENVIOS DE WHATSAPP - QUERY RÁPIDA
-- ============================================================================
-- Use esta query para monitorar os envios em tempo real
-- ============================================================================

-- RESUMO RÁPIDO
SELECT 
    status,
    COUNT(*) as total,
    STRING_AGG(DISTINCT c.nome, ', ' ORDER BY c.nome) as clientes
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'SENT' THEN 3
        WHEN 'SKIPPED' THEN 4
        WHEN 'FAILED' THEN 5
    END;

-- ÚLTIMAS MENSAGENS ENVIADAS (últimas 10)
SELECT 
    c.nome as cliente,
    c.telefone as telefone_original,
    '55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    ) as numero_enviado,
    q.last_attempt_at as enviado_em,
    s.name as loja,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 10;

