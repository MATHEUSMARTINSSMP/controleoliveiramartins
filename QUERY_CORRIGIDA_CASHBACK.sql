-- ============================================================================
-- ✅ QUERY CORRIGIDA: Últimos Pedidos Sincronizados com Cashback
-- ============================================================================
-- CORREÇÃO: Removido o.cliente_cpf (não existe) e adicionado JOIN correto
-- para obter o CPF da tabela tiny_contacts

SELECT
    o.id,
    o.tiny_id,
    o.numero_pedido,
    o.data_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_nome,
    o.cliente_id,
    c.cpf_cnpj as cliente_cpf,  -- ✅ CORRIGIDO: CPF vem de tiny_contacts
    ct.id as cashback_transaction_id,
    ct.amount as cashback_amount,
    ct.created_at as cashback_created_at,
    cb.balance_disponivel as cashback_saldo_disponivel
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id  -- ✅ CORRIGIDO: JOIN por ID, não por nome
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON o.cliente_id = cb.cliente_id
ORDER BY o.created_at DESC
LIMIT 5;

-- ============================================================================
-- PRINCIPAIS CORREÇÕES REALIZADAS:
-- ============================================================================
-- ❌ ANTES: o.cliente_cpf (coluna não existe)
-- ✅ AGORA: c.cpf_cnpj (da tabela tiny_contacts)
--
-- ❌ ANTES: LEFT JOIN ON o.cliente_nome = c.nome (pode ter duplicatas)
-- ✅ AGORA: LEFT JOIN ON o.cliente_id = c.id (chave estrangeira correta)
-- ============================================================================

