# Migração para Suporte Multi-ERP

## Problema
Atualmente, a tabela `sales` tem uma coluna `tiny_order_id` específica para o Tiny ERP. Se tivermos 50 ERPs diferentes, não faz sentido ter 50 colunas diferentes.

## Solução
Usar uma estrutura normalizada genérica:

### Colunas Genéricas
- `external_order_id` (TEXT): ID do pedido no ERP externo (genérico)
- `order_source` (TEXT): Origem do pedido ('TINY', 'LINX', 'MICROVIX', etc)

### Índice Único
```sql
UNIQUE(external_order_id, order_source) WHERE external_order_id IS NOT NULL
```

Isso garante que cada pedido de um ERP gere apenas uma venda, sem precisar de colunas específicas.

## Como Usar

### Criar Venda de Pedido Externo
```sql
INSERT INTO sistemaretiradas.sales (
    external_order_id,
    order_source,
    colaboradora_id,
    store_id,
    valor,
    -- ... outros campos
) VALUES (
    'pedido-123',  -- ID do pedido no ERP
    'TINY',        -- Origem: TINY, LINX, MICROVIX, etc
    -- ... outros valores
);
```

### Verificar se Pedido Já Gerou Venda
```sql
SELECT sistemaretiradas.external_order_has_sale('pedido-123', 'TINY');
-- Retorna TRUE se já existe, FALSE caso contrário
```

### Buscar Venda por Pedido Externo
```sql
SELECT sistemaretiradas.get_sale_by_external_order('pedido-123', 'TINY');
-- Retorna UUID da venda ou NULL
```

### Buscar no JavaScript/TypeScript
```typescript
// Verificar se pedido já gerou venda
const { data } = await supabase
  .rpc('external_order_has_sale', {
    p_external_order_id: orderId,
    p_order_source: 'TINY'
  });

// Buscar venda existente
const { data: saleId } = await supabase
  .rpc('get_sale_by_external_order', {
    p_external_order_id: orderId,
    p_order_source: 'TINY'
  });

// Criar nova venda
const { data: newSale } = await supabase
  .from('sales')
  .insert({
    external_order_id: orderId,
    order_source: 'TINY',
    // ... outros campos
  })
  .select()
  .single();
```

## Migração do Código

### Para Código Existente (Compatibilidade)
A migration automaticamente migra dados de `tiny_order_id` para `external_order_id` com `order_source = 'TINY'`.

**Código atual (funciona, mas legado):**
```typescript
// Buscar vendas de hoje
const { data: vendasHoje } = await supabase
  .from('sales')
  .select('valor, tiny_order_id')
  .eq('store_id', storeId)
  .eq('tiny_order_id', orderId);
```

**Código novo (recomendado):**
```typescript
// Buscar vendas de hoje
const { data: vendasHoje } = await supabase
  .from('sales')
  .select('valor, external_order_id, order_source')
  .eq('store_id', storeId)
  .eq('external_order_id', orderId)
  .eq('order_source', 'TINY');
```

### Para Novos ERPs
Simplesmente use `external_order_id` e `order_source`:

```typescript
// Para LINX
await supabase
  .from('sales')
  .insert({
    external_order_id: linxOrderId,
    order_source: 'LINX',
    // ...
  });

// Para MICROVIX
await supabase
  .from('sales')
  .insert({
    external_order_id: microvixOrderId,
    order_source: 'MICROVIX',
    // ...
  });
```

## Planos Futuros

1. **Fase 1 (Atual)**: Adicionar `external_order_id` e `order_source`, manter `tiny_order_id` para compatibilidade
2. **Fase 2**: Migrar todo o código para usar `external_order_id` + `order_source`
3. **Fase 3**: Marcar `tiny_order_id` como DEPRECATED
4. **Fase 4**: Remover `tiny_order_id` após período de transição

## Constantes para Order Source

Recomenda-se criar um enum ou constantes:

```typescript
// src/lib/erp-constants.ts
export const ORDER_SOURCE = {
  TINY: 'TINY',
  LINX: 'LINX',
  MICROVIX: 'MICROVIX',
  BLING: 'BLING',
  // Adicione novos conforme necessário
} as const;

export type OrderSource = typeof ORDER_SOURCE[keyof typeof ORDER_SOURCE];
```

