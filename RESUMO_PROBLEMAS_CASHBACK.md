# 🔍 Diagnóstico: Problemas do Sistema de Cashback

## ✅ PROBLEMAS IDENTIFICADOS E SOLUÇÕES

### 1. ❌ Erro: `column ct.status does not exist`

**Problema:** As queries SQL estavam tentando usar `ct.status`, mas essa coluna **não existe** na tabela `cashback_transactions`.

**Estrutura real da tabela:**
- `transaction_type` (EARNED, REDEEMED, EXPIRED, ADJUSTMENT)
- `data_liberacao` (quando o cashback será liberado)
- `data_expiracao` (quando o cashback expira)
- `renovado` (boolean)

**Solução:** Remover todas as referências a `ct.status` e usar `data_liberacao` + `data_expiracao` para determinar o status.

---

### 2. ❌ **CRÍTICO: Configurações de Cashback estão todas NULL**

**Problema:** Todas as lojas estão retornando `null` para as configurações de cashback. **Sem configuração, nenhum cashback é gerado!**

**Causa:** A tabela `cashback_settings` está vazia. O sistema precisa de pelo menos uma configuração global ou por loja para funcionar.

**Solução:** Execute o script `QUERY_CASHBACK_CONFIGURACAO.sql` no Supabase SQL Editor para inserir as configurações padrão.

**Valores padrão sugeridos:**
- `percentual_cashback`: 15.00% (15%)
- `prazo_liberacao_dias`: 2 dias após a compra
- `prazo_expiracao_dias`: 30 dias após liberação
- `percentual_uso_maximo`: 30.00% (máximo 30% da compra pode ser pago com cashback)
- `renovacao_habilitada`: true
- `renovacao_dias`: 3 dias

---

### 3. ❌ Nenhum Cashback está sendo gerado

**Problema:** Os pedidos mostram `cashback_transaction_id: null`, indicando que nenhum cashback foi gerado.

**Causas possíveis:**
1. **Configurações ausentes** (veja problema #2) ✅
2. **Trigger não está sendo executado** - Verificar se o trigger está ativo
3. **Pedidos não atendem aos critérios:**
   - `cliente_id` não é NULL
   - `valor_total > 0`
   - `situacao` não é 'cancelado'
   - Cliente tem CPF/CNPJ válido (11+ dígitos)

**Como verificar:**
```sql
-- Ver pedidos que NÃO geraram cashback (para debug)
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
        WHEN c.cpf_cnpj IS NULL OR TRIM(c.cpf_cnpj) = '' THEN 'Cliente sem CPF/CNPJ'
        WHEN LENGTH(REGEXP_REPLACE(c.cpf_cnpj, '\D', '', 'g')) < 11 THEN 'CPF/CNPJ inválido'
        ELSE 'Outro motivo - verificar trigger e configurações'
    END as motivo_sem_cashback
FROM sistemaretiradas.tiny_orders o
LEFT JOIN sistemaretiradas.tiny_contacts c ON o.cliente_id = c.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON o.id = ct.tiny_order_id
WHERE ct.id IS NULL
    AND o.valor_total > 0
    AND o.situacao NOT IN ('cancelado', 'Cancelado')
ORDER BY o.data_pedido DESC
LIMIT 20;
```

---

## 📋 CHECKLIST DE CORREÇÃO

- [ ] 1. Executar `QUERY_CASHBACK_CONFIGURACAO.sql` para criar configurações
- [ ] 2. Verificar se as configurações foram criadas:
   ```sql
   SELECT * FROM sistemaretiradas.cashback_settings;
   ```
- [ ] 3. Verificar se o trigger está ativo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%cashback%';
   ```
- [ ] 4. Re-sincronizar pedidos ou executar manualmente:
   ```sql
   -- Para um pedido específico (exemplo)
   SELECT sistemaretiradas.gerar_cashback(
       'uuid-do-pedido',
       'uuid-do-cliente',
       'uuid-da-loja',
       1000.00
   );
   ```
- [ ] 5. Usar as queries corrigidas em `supabase/migrations/20250128000003_test_cashback_queries.sql`

---

## 🔧 PRÓXIMOS PASSOS

1. **Execute a configuração** - `QUERY_CASHBACK_CONFIGURACAO.sql`
2. **Verifique os triggers** - Certifique-se de que estão ativos
3. **Re-sincronize pedidos recentes** - Ou execute a função manualmente para testar
4. **Monitore os logs** - Verifique se há erros na geração de cashback

---

## 📝 NOTAS IMPORTANTES

- A função `get_cashback_settings` tem valores padrão em memória, mas é melhor ter configurações explícitas no banco.
- O trigger `trg_tiny_orders_after_insert_update` deve chamar `gerar_cashback` automaticamente quando um pedido é inserido/atualizado.
- Verifique os logs do Netlify Function durante a sincronização para ver se há erros ao chamar `gerar_cashback`.

