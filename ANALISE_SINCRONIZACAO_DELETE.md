# 🔍 ANÁLISE: Remoção de Pedidos do Tiny ERP

## ❌ RESPOSTA DIRETA

**NÃO, quando você apaga uma venda no Tiny ERP, ela NÃO é apagada automaticamente do Supabase.**

---

## 📋 COMO FUNCIONA A SINCRONIZAÇÃO ATUAL

### Fluxo de Sincronização (Tiny → Supabase):

1. **Busca pedidos do Tiny ERP** via API
2. **Para cada pedido encontrado:**
   - Verifica se já existe no Supabase
   - Se existe: **UPDATE** (atualiza dados)
   - Se não existe: **INSERT** (cria novo registro)
3. **Usa `upsert`** com `onConflict` para evitar duplicatas

### ⚠️ Limitação Atual:

A sincronização é **UNIDIRECIONAL** e apenas para pedidos que **EXISTEM** no Tiny:
- ✅ Busca pedidos que **estão** no Tiny
- ✅ Insere/Atualiza no Supabase
- ❌ **NÃO verifica** pedidos que foram **removidos** do Tiny
- ❌ **NÃO remove** pedidos do Supabase quando deletados no Tiny

---

## 🔍 CÓDIGO ATUAL

No arquivo `netlify/functions/sync-tiny-orders-background.js`:

```javascript
// Linha ~772-779: Apenas INSERT ou UPDATE
const { error: upsertError, data: savedOrder } = await supabase
  .schema('sistemaretiradas')
  .from('tiny_orders')
  .upsert(orderData, {
    onConflict: 'numero_pedido,store_id',
  })
  .select('id')
  .single();
```

**Não há lógica de DELETE!**

---

## 💡 SOLUÇÕES POSSÍVEIS

### Opção 1: Sincronização Reversa (Recomendada)

Adicionar lógica para verificar pedidos que não existem mais no Tiny:

```javascript
// 1. Buscar TODOS os pedidos do Supabase para a loja
const { data: pedidosSupabase } = await supabase
  .from('tiny_orders')
  .select('tiny_id, numero_pedido')
  .eq('store_id', storeId);

// 2. Buscar TODOS os pedidos do Tiny (mesmo período)
const pedidosTiny = await buscarPedidosDoTiny(storeId, dataInicio);

// 3. Identificar pedidos que estão no Supabase mas NÃO no Tiny
const pedidosParaRemover = pedidosSupabase.filter(
  supabase => !pedidosTiny.find(tiny => tiny.id === supabase.tiny_id)
);

// 4. Remover pedidos deletados
for (const pedido of pedidosParaRemover) {
  await supabase
    .from('tiny_orders')
    .delete()
    .eq('id', pedido.id);
}
```

**Vantagens:**
- ✅ Remove pedidos deletados automaticamente
- ✅ Mantém Supabase sincronizado com Tiny

**Desvantagens:**
- ⚠️ Requer buscar TODOS os pedidos do Tiny (pode ser lento)
- ⚠️ Pode remover pedidos antigos que não aparecem na busca

---

### Opção 2: Marcar como Cancelado (Mais Seguro)

Ao invés de deletar, marcar como cancelado quando detectar remoção:

```javascript
// Adicionar coluna na tabela
ALTER TABLE sistemaretiradas.tiny_orders 
ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

// Marcar como deletado ao invés de remover
await supabase
  .from('tiny_orders')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', pedido.id);
```

**Vantagens:**
- ✅ Mantém histórico completo
- ✅ Não perde dados de cashback/transações
- ✅ Pode filtrar pedidos deletados nas queries

**Desvantagens:**
- ⚠️ Pedidos deletados ainda ocupam espaço no banco

---

### Opção 3: Verificar Status no Tiny

Verificar se pedido tem status de cancelado/deletado:

```javascript
// Quando sincronizar, verificar status
if (pedidoTiny.situacao === 'Cancelado' || pedidoTiny.situacao === 'Deletado') {
  // Marcar como deletado no Supabase
  await supabase
    .from('tiny_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tiny_id', pedidoTiny.id);
}
```

**Vantagens:**
- ✅ Mais simples
- ✅ Detecta cancelamentos também

**Desvantagens:**
- ⚠️ Depende do Tiny marcar como cancelado (pode não fazer)

---

### Opção 4: Manter Como Está + Limpeza Manual

Manter comportamento atual e criar função manual para limpar:

```sql
-- Criar função RPC para limpar pedidos deletados
CREATE OR REPLACE FUNCTION limpar_pedidos_deletados(p_store_id UUID)
RETURNS INTEGER AS $$
DECLARE
  pedidos_removidos INTEGER;
BEGIN
  -- Lógica para identificar e remover pedidos
  -- ...
  RETURN pedidos_removidos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Vantagens:**
- ✅ Controle manual
- ✅ Não afeta sincronização automática

**Desvantagens:**
- ⚠️ Requer execução manual

---

## 🎯 RECOMENDAÇÃO

**Combinar Opção 2 + Opção 3:**

1. **Adicionar coluna `deleted_at`** na tabela
2. **Marcar como deletado** quando detectar que não existe mais no Tiny
3. **Filtrar pedidos deletados** nas queries do frontend
4. **Manter histórico** para auditoria

Isso permite:
- ✅ Sincronização automática de remoções
- ✅ Preservação de histórico
- ✅ Facilita reverter se necessário

---

## 📊 IMPACTO ATUAL

**Se um pedido é deletado no Tiny:**
- ❌ Permanece no Supabase
- ❌ Pode gerar dados inconsistentes
- ❌ Pode aparecer em relatórios
- ❌ Cashback pode continuar válido

**Recomendação:** Implementar uma das soluções acima o mais rápido possível.

---

**Data da Análise:** 2025-01-31
**Status:** Sincronização atual NÃO remove pedidos deletados

