# Queries SQL para Testar o Sistema de Cashback

## ⚠️ Erro Comum Encontrado

**Erro:** `ERROR: 42703: column o.cliente_cpf does not exist`

**Causa:** A coluna `cliente_cpf` não existe na tabela `tiny_orders`. O CPF está na tabela `tiny_contacts`.

**Solução:** Use `c.cpf_cnpj` após fazer JOIN com `tiny_contacts`.

---

## ✅ Query Corrigida: Últimos Pedidos Sincronizados com Cashback

```sql
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
    cb.saldo_disponivel as cashback_saldo_disponivel
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id  -- ✅ JOIN correto por ID
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON o.cliente_id = cb.cliente_id
ORDER BY o.created_at DESC
LIMIT 10;
```

### Principais Correções:

1. ✅ Removido `o.cliente_cpf` (não existe)
2. ✅ Adicionado JOIN com `tiny_contacts` por `cliente_id`: `ON o.cliente_id = c.id`
3. ✅ Usar `c.cpf_cnpj` em vez de `o.cliente_cpf`

---

## 📊 Outras Queries Úteis para Teste

### 1. Resumo de Cashback por Cliente

```sql
SELECT
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.cpf_cnpj,
    COUNT(DISTINCT o.id) as total_pedidos,
    SUM(o.valor_total) as valor_total_compras,
    cb.saldo_disponivel,
    cb.balance_pendente
FROM sistemaretiradas.tiny_contacts c
LEFT JOIN sistemaretiradas.tiny_orders o ON c.id = o.cliente_id
LEFT JOIN sistemaretiradas.cashback_balance cb ON c.id = cb.cliente_id
WHERE c.cpf_cnpj IS NOT NULL AND c.cpf_cnpj != ''
GROUP BY c.id, c.nome, c.cpf_cnpj, cb.saldo_disponivel, cb.balance_pendente
ORDER BY cb.saldo_disponivel DESC NULLS LAST
LIMIT 20;
```

### 2. Pedidos que NÃO geraram cashback (para debug)

```sql
SELECT
    o.id,
    o.numero_pedido,
    o.valor_total,
    o.situacao,
    o.cliente_nome,
    c.cpf_cnpj,
    CASE
        WHEN o.cliente_id IS NULL THEN 'Sem cliente'
        WHEN o.valor_total <= 0 THEN 'Valor zero'
        WHEN o.situacao IN ('cancelado', 'Cancelado') THEN 'Pedido cancelado'
        WHEN c.cpf_cnpj IS NULL OR TRIM(c.cpf_cnpj) = '' THEN 'Cliente sem CPF'
        ELSE 'Outro motivo'
    END as motivo_sem_cashback
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
WHERE ct.id IS NULL
    AND o.valor_total > 0
ORDER BY o.data_pedido DESC
LIMIT 20;
```

### 3. Configurações de Cashback

```sql
SELECT
    s.name as store_name,
    cs.percentual_cashback,
    cs.prazo_liberacao_dias,
    cs.prazo_expiracao_dias
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.cashback_settings cs ON s.id = cs.store_id
WHERE s.active = true;
```

---

## 📝 Notas Importantes

- **`tiny_orders`** tem `cliente_id` (FK para `tiny_contacts`), não `cliente_cpf`
- **`tiny_contacts`** tem `cpf_cnpj`, não `cliente_cpf`
- Sempre faça JOIN por `cliente_id`: `ON o.cliente_id = c.id`
- CPF deve ser obtido de `c.cpf_cnpj` após o JOIN

---

**Arquivo completo de queries:** `supabase/migrations/20250128000003_test_cashback_queries.sql`

