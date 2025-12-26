# Guia do Desenvolvedor: Prevenção de Duplicação em Totais

## ⚠️ Problema Comum: Duplicação de Valores

Ao calcular totais de vendas **durante a criação de uma nova venda**, é comum cair na armadilha de contar a venda atual duas vezes.

### ❌ Código INCORRETO (com bug)

```typescript
// Buscar todas as vendas do dia
const { data: sales } = await supabase
  .from('sales')
  .select('valor')
  .eq('store_id', storeId)
  .gte('data_venda', `${today}T00:00:00`)
  .lte('data_venda', `${today}T23:59:59`);

const total = sales.reduce((sum, s) => sum + s.valor, 0);

// ❌ PROBLEMA: Se a venda atual já estiver no banco,
// ela será contada na query acima.
// Se você adicionar novamente, será contada DUAS vezes!
const totalComVendaAtual = total + currentSaleValue; // ❌ DUPLICATA!
```

**Por que isso acontece?**
- Após `insert()`, a venda já está no banco
- `refetchSales()` ou delays podem fazer a venda aparecer na query
- Timing inconsistente = comportamento imprevisível

---

## ✅ Solução CORRETA

### Opção 1: Usar Helper Functions (RECOMENDADO)

```typescript
import { calculateSalesTotals } from '@/lib/sales-totals';

// Ao criar uma nova venda
const { totalDia, totalMes } = await calculateSalesTotals({
  storeId: 'store-123',
  currentSaleId: insertedSale.id,  // ✅ Excluir esta venda
  currentSaleValue: 228.00,         // ✅ Adicionar este valor
});

// Usar nos totais
const message = formatVendaMessage({
  ...otherParams,
  totalDia,   // ✅ Valor correto
  totalMes,   // ✅ Valor correto
});
```

### Opção 2: Implementar Manualmente

```typescript
// ✅ EXCLUIR explicitamente a venda atual
const { data: sales } = await supabase
  .from('sales')
  .select('valor')
  .eq('store_id', storeId)
  .gte('data_venda', `${today}T00:00:00`)
  .lte('data_venda', `${today}T23:59:59`)
  .neq('id', currentSaleId); // ✅ CHAVE: Excluir venda atual

// Calcular total SEM a venda atual
const totalSemVendaAtual = sales.reduce((sum, s) => sum + s.valor, 0);

// ✅ SEMPRE adicionar a venda atual
const total = totalSemVendaAtual + currentSaleValue;
```

---

## 🎯 Regra de Ouro

> **NUNCA** tente verificar se a venda já está incluída.
> **SEMPRE** exclua explicitamente e depois adicione.

### Por quê?

| Abordagem | Problema |
|-----------|----------|
| Verificar se está incluída | Depende de timing, inconsistente |
| Excluir + Adicionar | Determinístico, sempre funciona |

---

## 📋 Checklist para Desenvolvedores

Ao calcular totais durante criação/edição de vendas:

- [ ] ✅ Usar `calculateSalesTotals()` de `@/lib/sales-totals`
- [ ] ✅ OU usar `.neq('id', currentSaleId)` na query
- [ ] ✅ SEMPRE adicionar o valor atual depois
- [ ] ❌ NUNCA confiar em verificações de "já incluída"
- [ ] ❌ NUNCA somar a venda atual sem excluir da query

---

## 🧪 Como Testar

```bash
# Executar testes automatizados
npx tsx scripts/test-sales-totals.ts
```

O teste verifica:
1. Totais diários estão corretos
2. Não há duplicatas em cálculos
3. Simulação de criação de venda

---

## 📚 Referências

- **Helper Functions**: [`src/lib/sales-totals.ts`](file:///home/matheusmartins/controleoliveiramartins/src/lib/sales-totals.ts)
- **Exemplo de Uso**: [`src/pages/LojaDashboard.tsx`](file:///home/matheusmartins/controleoliveiramartins/src/pages/LojaDashboard.tsx#L2989-L3008)
- **Testes**: [`scripts/test-sales-totals.ts`](file:///home/matheusmartins/controleoliveiramartins/scripts/test-sales-totals.ts)

---

## 🚨 Casos de Uso

### Caso 1: Mensagem WhatsApp após venda

```typescript
// ✅ CORRETO
const { totalDia, totalMes } = await calculateSalesTotals({
  storeId,
  currentSaleId: insertedSale.id,
  currentSaleValue: parseFloat(saleData.valor),
});

const message = formatVendaMessage({
  colaboradoraName,
  valor: saleData.valor,
  totalDia,  // ✅ Sem duplicata
  totalMes,  // ✅ Sem duplicata
});
```

### Caso 2: Dashboard em tempo real

```typescript
// ✅ CORRETO - Não precisa excluir nada
// (apenas exibindo vendas já salvas)
const { data: sales } = await supabase
  .from('sales')
  .select('valor')
  .eq('store_id', storeId);

const total = sales.reduce((sum, s) => sum + s.valor, 0);
```

### Caso 3: Edição de venda

```typescript
// ✅ CORRETO - Excluir a venda sendo editada
const { data: sales } = await supabase
  .from('sales')
  .select('valor')
  .eq('store_id', storeId)
  .neq('id', editingSaleId); // ✅ Excluir venda em edição

const total = sales.reduce((sum, s) => sum + s.valor, 0) + newSaleValue;
```

---

## 💡 Dica Final

**Se você está calculando um total que INCLUI uma venda que acabou de criar/editar:**
- ✅ Use `calculateSalesTotals()` 
- ✅ OU use `.neq('id', saleId)` + adicione manualmente

**Se você está apenas exibindo vendas já salvas:**
- ✅ Pode usar `.reduce()` direto, sem preocupações
