# 📊 RELATÓRIO: Armazenamento de Pedidos Tiny ERP no Supabase

## 🔍 Situação Atual

### Total de Pedidos Armazenados
- **Total na tabela `tiny_orders`:** 1.238 pedidos
- **Limite padrão do Supabase:** 1.000 registros por query

### ⚠️ Problema Identificado

O Supabase tem um **limite padrão de 1.000 registros por query**. Isso significa que:

1. **O banco tem 1.238 pedidos**, mas quando você faz uma query sem especificar paginação, você só vê os primeiros 1.000
2. **O componente `TinyOrdersList.tsx` está limitando ainda mais** para 100 pedidos (linha 245)
3. Para acessar todos os 1.238 pedidos, é necessário usar **paginação**

## 📋 Estrutura da Tabela `tiny_orders`

### Campos Principais:
- `id` (UUID, PK)
- `store_id` (UUID, FK → stores)
- `tiny_id` (String) - ID do pedido no Tiny ERP
- `numero_pedido` (String) - Número do pedido
- `data_pedido` (Timestamp)
- `valor_total` (Numeric)
- `cliente_id` (UUID, FK → tiny_contacts)
- `colaboradora_id` (UUID, FK → profiles)
- `itens` (JSONB) - Itens do pedido
- `sync_at` (Timestamp) - Última sincronização
- `created_at`, `updated_at` (Timestamps)

### Índices e Constraints:
- `idx_tiny_orders_numero_store` - Índice único em (numero_pedido, store_id)
- `idx_tiny_orders_tiny_id_store` - Índice único em (tiny_id, store_id)

## 🔧 Como os Pedidos São Armazenados

### Fluxo de Sincronização:

1. **Netlify Function** (`sync-tiny-orders-background.js`) busca pedidos do Tiny ERP
2. **Insere/Atualiza** na tabela `tiny_orders` usando `upsert` com `onConflict`
3. **Trigger automático** gera cashback quando pedido é inserido/atualizado
4. **Realtime** notifica frontend quando novo pedido chega

### Lógica de Upsert:
```javascript
// Usa onConflict para evitar duplicatas
.insert(pedidoFormatado)
.select()
.single()
// Se já existe, atualiza com novos dados
```

## 📊 Distribuição dos Pedidos

- **Loja cee7d359-0240-4131-87a2-21ae44bd1bb4:** 1.000+ pedidos (limite atingido na query de contagem)

## ⚠️ Limitações Encontradas

### 1. Limite do Supabase (1.000 registros por query)
- **Problema:** Queries sem paginação retornam no máximo 1.000 registros
- **Solução:** Implementar paginação usando `.range()` ou `.limit()` + `.offset()`

### 2. Limite no Componente Frontend (100 pedidos)
- **Localização:** `src/components/erp/TinyOrdersList.tsx` linha 245
- **Código atual:**
  ```typescript
  .limit(Math.min(limit, 100)); // ✅ Máximo 100 registros
  ```

## 💡 Recomendações

### 1. Implementar Paginação Completa

Para acessar todos os 1.238 pedidos, implementar paginação:

```typescript
// Buscar com paginação
const pageSize = 100;
const page = 1;
const { data, error } = await supabase
  .from('tiny_orders')
  .select('*')
  .eq('store_id', storeId)
  .order('data_pedido', { ascending: false })
  .range((page - 1) * pageSize, page * pageSize - 1);
```

### 2. Aumentar Limite no Frontend (ou remover limite)

No `TinyOrdersList.tsx`, considerar:
- Opção 1: Aumentar limite para 1000 (máximo do Supabase)
- Opção 2: Implementar paginação infinita/scroll
- Opção 3: Implementar paginação tradicional com páginas

### 3. Usar RPC para Contagens Grandes

Para contagens de grandes volumes, criar uma função RPC no banco:

```sql
CREATE OR REPLACE FUNCTION count_tiny_orders_by_store(p_store_id UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sistemaretiradas.tiny_orders WHERE store_id = p_store_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🔍 Verificação Técnica

### Queries Executadas:
1. ✅ Contagem total: 1.238 pedidos
2. ✅ Amostra de estrutura: OK
3. ✅ Distribuição por loja: 1 loja com 1.000+ pedidos
4. ✅ Últimos pedidos: OK (mostrando pedidos recentes)

### Conclusão:
**NÃO há limitação de armazenamento de 999 linhas!** 

- O banco tem **1.238 pedidos** armazenados
- O limite de 999/1000 que você está vendo é devido ao **limite padrão do Supabase** de 1.000 registros por query
- Para ver todos os pedidos, é necessário implementar **paginação**

---

**Data da Análise:** 2025-01-31
**Total de Pedidos:** 1.238
**Limite Supabase:** 1.000 por query (padrão)

