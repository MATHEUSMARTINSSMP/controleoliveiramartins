-- ============================================================================
-- ✅ QUERY FINAL CORRIGIDA: Últimos Pedidos Sincronizados com Cashback
-- ============================================================================
-- CORREÇÕES APLICADAS:
-- 1. Removido o.cliente_cpf (não existe) → usar c.cpf_cnpj
-- 2. JOIN correto: o.cliente_id = c.id (não por nome)
-- 3. Coluna correta: cb.balance_disponivel (não saldo_disponivel)

SELECT
    o.id,
    o.tiny_id,
    o.numero_pedido,
    o.data_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_nome,
    o.cliente_id,
    c.cpf_cnpj as cliente_cpf,  -- ✅ CPF vem de tiny_contacts
    ct.id as cashback_transaction_id,
    ct.amount as cashback_amount,
    ct.created_at as cashback_created_at,
    cb.balance_disponivel as cashback_saldo_disponivel  -- ✅ COLUNA CORRETA
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id  -- ✅ JOIN por ID
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON o.cliente_id = cb.cliente_id
ORDER BY o.created_at DESC
LIMIT 5;

-- ============================================================================
-- ESTRUTURA DA TABELA cashback_balance:
-- ============================================================================
-- ✅ balance (NUMERIC) - Saldo total
-- ✅ balance_disponivel (NUMERIC) - Saldo disponível para uso
-- ✅ balance_pendente (NUMERIC) - Saldo pendente de liberação
-- ✅ total_earned (NUMERIC) - Total acumulado ganho
-- ============================================================================

