-- ============================================================================
-- ✅ QUERY PRONTA PARA COPIAR NO SUPABASE SQL EDITOR
-- ============================================================================
-- Esta é a query corrigida que você pode copiar e colar diretamente no Supabase

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
    cb.balance_disponivel as cashback_saldo_disponivel  -- ✅ COLUNA CORRETA: balance_disponivel
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON o.cliente_id = cb.cliente_id
ORDER BY o.created_at DESC
LIMIT 5;

-- ============================================================================
-- CORREÇÕES APLICADAS:
-- ============================================================================
-- ❌ ANTES: o.cliente_cpf (coluna não existe em tiny_orders)
-- ✅ AGORA: c.cpf_cnpj (da tabela tiny_contacts após JOIN)
--
-- ❌ ANTES: cb.saldo_disponivel (coluna não existe)
-- ✅ AGORA: cb.balance_disponivel (coluna correta da tabela cashback_balance)
-- ============================================================================

