-- ============================================================================
-- QUERIES DE TESTE PARA MECANISMOS DE CASHBACK
-- ============================================================================
-- Este arquivo contém queries SQL úteis para testar e debugar o sistema de cashback
-- NÃO é uma migration, apenas queries de referência e teste

-- ============================================================================
-- QUERY 1: Últimos Pedidos Sincronizados com Cashback
-- ============================================================================
-- ✅ CORRIGIDA: Usa cliente_id para JOIN e cpf_cnpj da tabela tiny_contacts
SELECT
    o.id,
    o.tiny_id,
    o.numero_pedido,
    o.data_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_nome,
    o.cliente_id,
    c.cpf_cnpj as cliente_cpf,  -- ✅ CPF vem de tiny_contacts, não de tiny_orders
    ct.id as cashback_transaction_id,
    ct.amount as cashback_amount,
    ct.created_at as cashback_created_at,
    cb.balance_disponivel as cashback_saldo_disponivel
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id  -- ✅ JOIN correto por ID
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON o.cliente_id = cb.cliente_id
ORDER BY o.created_at DESC
LIMIT 10;

-- ============================================================================
-- QUERY 2: Resumo de Cashback por Cliente
-- ============================================================================
SELECT
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.cpf_cnpj,
    COUNT(DISTINCT o.id) as total_pedidos,
    SUM(o.valor_total) as valor_total_compras,
    COUNT(DISTINCT ct.id) as total_transacoes_cashback,
    SUM(ct.amount) FILTER (WHERE ct.transaction_type = 'earned') as total_ganho,
    SUM(ct.amount) FILTER (WHERE ct.transaction_type = 'redeemed') as total_usado,
    cb.balance_disponivel as saldo_disponivel,
    cb.balance_pendente,
    cb.total_earned
FROM sistemaretiradas.tiny_contacts c
LEFT JOIN sistemaretiradas.tiny_orders o ON c.id = o.cliente_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON c.id = cb.cliente_id
WHERE c.cpf_cnpj IS NOT NULL AND c.cpf_cnpj != ''
GROUP BY c.id, c.nome, c.cpf_cnpj, cb.balance_disponivel, cb.balance_pendente, cb.total_earned
ORDER BY cb.balance_disponivel DESC NULLS LAST
LIMIT 20;

-- ============================================================================
-- QUERY 3: Pedidos com Cashback Gerado
-- ============================================================================
SELECT
    o.id as pedido_id,
    o.numero_pedido,
    o.data_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_nome,
    c.cpf_cnpj,
    ct.id as transaction_id,
    ct.transaction_type,
    ct.amount,
    ct.data_liberacao,
    ct.data_expiracao,
    ct.renovado
FROM sistemaretiradas.tiny_orders o
INNER JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
WHERE ct.transaction_type = 'EARNED'
ORDER BY ct.created_at DESC
LIMIT 20;

-- ============================================================================
-- QUERY 4: Pedidos que NÃO geraram cashback (para debug)
-- ============================================================================
SELECT
    o.id,
    o.numero_pedido,
    o.data_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_id,
    o.cliente_nome,
    c.cpf_cnpj,
    CASE
        WHEN o.cliente_id IS NULL THEN 'Sem cliente'
        WHEN o.valor_total <= 0 THEN 'Valor zero ou negativo'
        WHEN o.situacao IN ('cancelado', 'Cancelado') THEN 'Pedido cancelado'
        WHEN c.cpf_cnpj IS NULL OR TRIM(c.cpf_cnpj) = '' THEN 'Cliente sem CPF/CNPJ'
        WHEN LENGTH(REGEXP_REPLACE(c.cpf_cnpj, '\D', '', 'g')) < 11 THEN 'CPF/CNPJ inválido'
        ELSE 'Outro motivo'
    END as motivo_sem_cashback
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
WHERE ct.id IS NULL  -- Não tem cashback gerado
    AND o.valor_total > 0
    AND o.situacao NOT IN ('cancelado', 'Cancelado')
ORDER BY o.data_pedido DESC
LIMIT 20;

-- ============================================================================
-- QUERY 5: Configurações de Cashback Ativas
-- ============================================================================
SELECT
    s.id as store_id,
    s.name as store_name,
    cs.percentual_cashback,
    cs.prazo_liberacao_dias,
    cs.prazo_expiracao_dias,
    cs.renovacao_habilitada,
    cs.renovacao_dias
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.cashback_settings cs ON s.id = cs.store_id
WHERE s.active = true
ORDER BY s.name;

-- ============================================================================
-- QUERY 6: Saldos de Cashback Pendentes (aguardando liberação)
-- ============================================================================
SELECT
    cb.cliente_id,
    c.nome as cliente_nome,
    c.cpf_cnpj,
    cb.balance_pendente,
    COUNT(ct.id) as transacoes_pendentes,
    MIN(ct.data_liberacao) as proxima_liberacao
FROM sistemaretiradas.cashback_balance cb
INNER JOIN sistemaretiradas.tiny_contacts c ON cb.cliente_id = c.id
INNER JOIN sistemaretiradas.cashback_transactions ct ON cb.cliente_id = ct.cliente_id
WHERE ct.data_liberacao > NOW()
    AND ct.transaction_type = 'EARNED'
    AND cb.balance_pendente > 0
GROUP BY cb.cliente_id, c.nome, c.cpf_cnpj, cb.balance_pendente
ORDER BY cb.balance_pendente DESC
LIMIT 20;

-- ============================================================================
-- QUERY 7: Cashback Expirado que pode ser renovado
-- ============================================================================
SELECT
    ct.id as transaction_id,
    ct.cliente_id,
    c.nome as cliente_nome,
    ct.amount,
    ct.data_expiracao,
    ct.renovado,
    CASE
        WHEN ct.data_expiracao < NOW() THEN 'Expirado'
        WHEN ct.data_expiracao < NOW() + INTERVAL '7 days' THEN 'Expirando em breve'
        ELSE 'Válido'
    END as status_expiracao
FROM sistemaretiradas.cashback_transactions ct
INNER JOIN sistemaretiradas.tiny_contacts c ON ct.cliente_id = c.id
WHERE ct.transaction_type = 'EARNED'
    AND ct.data_liberacao <= NOW()
    AND ct.data_expiracao < NOW() + INTERVAL '7 days'
ORDER BY ct.data_expiracao ASC
LIMIT 20;

