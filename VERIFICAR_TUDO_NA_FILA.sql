-- ============================================================================
-- VERIFICAR TUDO NA FILA - DIAGNÓSTICO COMPLETO
-- ============================================================================
-- Esta query mostra TODAS as mensagens na fila com TODOS os detalhes
-- para identificar o que realmente aconteceu
-- ============================================================================

SELECT 
    -- Dados da fila
    q.id as fila_id,
    q.status,
    q.attempts as tentativas,
    q.error_message as erro,
    q.created_at as criado_em,
    q.last_attempt_at as ultima_tentativa,
    
    -- Dados do cliente
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    CASE 
        WHEN c.telefone IS NULL THEN 'NULL'
        WHEN c.telefone = '' THEN 'VAZIO'
        WHEN TRIM(c.telefone) = '' THEN 'APENAS_ESPACOS'
        ELSE c.telefone
    END as telefone_status,
    LENGTH(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')) as quantidade_digitos,
    
    -- Dados da loja
    s.name as loja_nome,
    s.id as loja_id,
    
    -- Dados da transação
    ct.id as transaction_id,
    ct.amount as valor_cashback,
    ct.data_expiracao,
    
    -- Dados do pedido
    ped.numero_pedido,
    ped.data_pedido
    
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
LEFT JOIN sistemaretiradas.tiny_orders ped ON ped.id = ct.tiny_order_id
ORDER BY q.created_at DESC;

-- ============================================================================
-- RESUMO POR STATUS (VERIFICAR SE HÁ PROBLEMAS)
-- ============================================================================

SELECT 
    q.status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE c.telefone IS NULL OR c.telefone = '' OR TRIM(c.telefone) = '') as sem_telefone,
    COUNT(*) FILTER (WHERE c.telefone IS NOT NULL AND c.telefone != '' AND LENGTH(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')) < 10) as telefone_invalido,
    COUNT(*) FILTER (WHERE c.nome IS NULL) as cliente_nao_encontrado
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
GROUP BY q.status
ORDER BY q.status;

