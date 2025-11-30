# ❌ RESPOSTA: Deletar Venda no Tiny = Deletar no Supabase?

## 🎯 RESPOSTA DIRETA

**NÃO!** Quando você apaga uma venda no Tiny ERP, ela **NÃO é apagada automaticamente** no Supabase.

---

## 🔍 COMO FUNCIONA HOJE

### Sincronização Atual:
- ✅ **Busca** pedidos que **EXISTEM** no Tiny
- ✅ **Insere** novos pedidos no Supabase
- ✅ **Atualiza** pedidos existentes
- ❌ **NÃO remove** pedidos deletados do Tiny

### O Que Acontece:

1. **Você apaga uma venda no Tiny** ❌
2. **O pedido continua no Supabase** ✅ (não é removido)
3. **Próxima sincronização:**
   - Busca pedidos do Tiny
   - Não encontra o pedido deletado
   - **MAS** não remove do Supabase (não há essa lógica)

---

## 📊 IMPACTO

### Problemas:
- ❌ Pedidos deletados continuam no Supabase
- ❌ Podem aparecer em relatórios
- ❌ Cashback pode continuar válido
- ❌ Dados inconsistentes entre Tiny e Supabase

### Exemplo:
- Tiny: 100 pedidos
- Supabase: 105 pedidos (incluindo 5 que foram deletados no Tiny)

---

## 💡 SOLUÇÕES

### Opção 1: Marcar como Deletado (Recomendada)

Adicionar coluna `deleted_at` e marcar quando não encontrar no Tiny:

```sql
-- Adicionar coluna
ALTER TABLE sistemaretiradas.tiny_orders 
ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
```

**Vantagem:** Mantém histórico, pode reverter se necessário

### Opção 2: Deletar Automaticamente

Implementar lógica para remover pedidos que não existem mais no Tiny:

**Vantagem:** Mantém Supabase 100% sincronizado

**Desvantagem:** Perde histórico, pode deletar por engano

### Opção 3: Verificar Status de Cancelamento

Quando sincronizar, verificar se pedido está cancelado no Tiny:

**Vantagem:** Detecta cancelamentos também

**Desvantagem:** Depende do Tiny marcar corretamente

---

## 🎯 RECOMENDAÇÃO

**Implementar Opção 1 + 3:**

1. Adicionar `deleted_at` na tabela
2. Durante sincronização, verificar se pedido existe no Tiny
3. Se não existir, marcar `deleted_at = NOW()`
4. Filtrar pedidos deletados nas queries (`WHERE deleted_at IS NULL`)

**Resultado:**
- ✅ Remove do fluxo normal
- ✅ Mantém histórico para auditoria
- ✅ Pode reverter se necessário
- ✅ Dados consistentes

---

## 🔧 IMPLEMENTAÇÃO NECESSÁRIA

Modificar `sync-tiny-orders-background.js` para:

1. Buscar todos os `tiny_id` dos pedidos no Supabase
2. Comparar com pedidos encontrados no Tiny
3. Identificar pedidos que não existem mais
4. Marcar como deletado (ou deletar, conforme escolha)

---

**Status Atual:** ⚠️ Sincronização NÃO remove pedidos deletados

**Ação Necessária:** Implementar lógica de detecção e remoção/marcação

