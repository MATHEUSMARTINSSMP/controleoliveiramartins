# 🔍 ANÁLISE PROFUNDA: COR, TAMANHO E VARIAÇÕES

## 📊 ONDE OS DADOS ESTÃO CHEGANDO

### 1. **ITENS DO PEDIDO** (GET /pedidos/{id})
- `item.produto` → `{ id, sku, descricao }` (dados básicos)
- `item.variacao` → `{ id, tamanho?, cor? }` (pode ter tamanho/cor direto)
- `item.grade` → `[{ chave, valor }]` (pode ter tamanho/cor na grade)
- `item.variacaoId` / `item.idVariacao` → ID da variação usada

### 2. **PRODUTO COMPLETO** (GET /produtos/{id})
- `produto.variacoes[]` → `{ id, grade: [{ chave, valor }] }`
- A grade contém: `chave` (tamanho, cor, etc.) e `valor`
- **CRÍTICO**: Tamanho e cor estão nas variações, não no produto raiz

## 🐛 PROBLEMAS IDENTIFICADOS

### ❌ PROBLEMA 1: Busca de Produto Completo Condicional
**Código atual:**
```typescript
if (produtoId && (!tamanho || !cor)) {
  // Só busca se FALTAR tamanho OU cor
}
```

**Problema:**
- Se já tiver tamanho do item, não busca cor das variações
- Se já tiver cor do item, não busca tamanho das variações
- Pode ter tamanho/cor incorretos ou incompletos

**✅ CORREÇÃO:**
```typescript
if (produtoId) {
  // SEMPRE buscar produto completo para garantir variações corretas
}
```

### ❌ PROBLEMA 2: Cor Não Normalizada
**Código atual:**
```typescript
cor = valor; // Não normaliza
```

**Problema:**
- Cor pode vir em minúscula, maiúscula, ou mista
- Inconsistência nos dados

**✅ CORREÇÃO:**
```typescript
cor = String(valor).trim().toUpperCase(); // Normalizar para maiúscula
```

### ❌ PROBLEMA 3: Hard Sync Limitado a 365 Dias
**Código atual:**
```typescript
if (hardSync) {
  dataInicioSync = umAnoAtras.toISOString(); // Apenas 365 dias
  maxPages = 999; // Apenas 99.900 pedidos
}
```

**Problema:**
- Não busca pedidos mais antigos
- Limite de páginas pode não ser suficiente

**✅ CORREÇÃO:**
```typescript
if (hardSync) {
  dataInicioSync = '2010-01-01'; // Desde sempre
  maxPages = 99999; // Praticamente ilimitado
}
```

### ❌ PROBLEMA 4: Horário do Pedido Sem Hora
**Código atual:**
```typescript
// Se for apenas data (YYYY-MM-DD), usa 00:00:00
const isoString = `${data}T00:00:00-03:00`;
```

**Problema:**
- Todos os pedidos ficam com hora 00:00:00
- Não reflete a hora real da venda

**✅ CORREÇÃO NECESSÁRIA:**
- Verificar se há `pedido.dataCriacao` com hora completa
- Se não houver, usar hora de criação do registro

## 🔧 FLUXO CORRETO DE EXTRAÇÃO

### 1. **EXTRAIR DO ITEM DO PEDIDO** (prioridade 1)
```typescript
// Tentar tamanho/cor diretos
tamanhoDoItem = item.tamanho || item.variacao?.tamanho
corDoItem = item.cor || item.variacao?.cor

// Tentar da grade do item
if (item.grade) {
  // Procurar tamanho/cor na grade
}
```

### 2. **EXTRAIR ID DA VARIAÇÃO**
```typescript
variacaoId = item.variacao?.id 
  || item.variacaoId 
  || item.idVariacao
  || item.variacao_id
```

### 3. **BUSCAR PRODUTO COMPLETO** (SEMPRE se tiver produtoId)
```typescript
if (produtoId) {
  produtoCompleto = await fetchProdutoCompletoFromTiny(produtoId);
  
  // Se tiver variacaoId, buscar variação específica
  if (variacaoId) {
    variacao = produtoCompleto.variacoes.find(v => v.id === variacaoId);
    // Extrair tamanho/cor da grade da variação
  } else {
    // Tentar TODAS as variações até encontrar tamanho/cor
    for (variacao of produtoCompleto.variacoes) {
      // Extrair tamanho/cor da grade
    }
  }
}
```

### 4. **NORMALIZAR E SALVAR**
```typescript
tamanho = normalizeTamanho(tamanho); // P, M, G, etc. em MAIÚSCULA
cor = String(cor).trim().toUpperCase(); // COR em MAIÚSCULA

// Salvar no JSON dos itens
itensComCategorias.push({
  tamanho,
  cor,
  // ... outros campos
});
```

## ✅ IMPLEMENTAÇÕES REALIZADAS

1. ✅ **Cor sempre normalizada para maiúscula**
2. ✅ **Busca de produto completo SEMPRE que tiver produtoId**
3. ✅ **Hard sync absoluto (desde 2010, sem limite prático de páginas)**
4. ⏳ **Horário do pedido** (a corrigir)

## 📝 PRÓXIMOS PASSOS

1. Corrigir extração de horário do pedido
2. Adicionar mais logs para debug
3. Testar com dados reais
4. Verificar se todos os tamanhos/cores estão sendo salvos

