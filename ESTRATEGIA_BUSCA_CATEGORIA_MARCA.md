# Estratégia de Busca de Categoria, Marca e Subcategoria

## Problema
Os produtos estão sendo sincronizados, mas faltam dados de **categoria**, **marca** e **subcategoria**.

## Solução Implementada: Duas Alternativas

### ✅ ALTERNATIVA 1: Dados Juntos com a Venda
**Verificar se categoria/marca já vêm no item do pedido**

```typescript
// Extrair do item diretamente (pode vir em diferentes formatos)
if (item.categoria) {
  categoriaDoItem = typeof item.categoria === 'string' 
    ? item.categoria 
    : item.categoria.nome || item.categoria.descricao || null;
}
if (item.marca) {
  marcaDoItem = typeof item.marca === 'string' 
    ? item.marca 
    : item.marca.nome || item.marca.descricao || null;
}
```

**Vantagens:**
- ✅ Mais rápido (não precisa fazer requisição adicional)
- ✅ Dados já disponíveis no pedido
- ✅ Menos chamadas à API

**Desvantagens:**
- ⚠️ Pode não estar disponível em todos os pedidos
- ⚠️ Dados podem estar incompletos

---

### ✅ ALTERNATIVA 2: GET Detalhes do Produto
**Usar o ID do produto para fazer GET de mais dados**

```typescript
// GET /produtos/{idProduto}
const produtoCompleto = await fetchProdutoCompletoFromTiny(storeId, produtoId);

// Extrair categoria
if (produtoCompleto.categoria) {
  categoria = produtoCompleto.categoria.nome;
  
  // Extrair subcategoria do caminho completo
  if (produtoCompleto.categoria.caminhoCompleto) {
    const caminho = produtoCompleto.categoria.caminhoCompleto.split(' > ');
    // Ex: "Roupas > Feminino > Vestidos"
    // categoria = "Feminino"
    // subcategoria = "Vestidos"
  }
}

// Extrair marca
if (produtoCompleto.marca) {
  marca = produtoCompleto.marca.nome;
}
```

**Vantagens:**
- ✅ Dados completos e atualizados
- ✅ Inclui subcategoria do caminho completo
- ✅ Inclui variações (tamanho, cor, etc.)

**Desvantagens:**
- ⚠️ Requer requisição adicional por produto
- ⚠️ Mais lento (mas temos cache)

---

## Estratégia de Prioridade

### 1️⃣ Primeiro: Tentar dados do item
```typescript
let categoria = categoriaDoItem; // Começar com dados do item
let marca = marcaDoItem;
let subcategoria = subcategoriaDoItem;
```

### 2️⃣ Depois: Buscar detalhes completos (se necessário)
```typescript
// Buscar APENAS se não temos dados do item
if (produtoId && (!categoria || !marca)) {
  produtoCompleto = await fetchProdutoCompletoFromTiny(storeId, produtoId);
  // Atualizar categoria/marca se não tínhamos
}
```

**Otimização:**
- ✅ Só busca detalhes se realmente precisar
- ✅ Cache evita requisições duplicadas
- ✅ Logs mostram qual fonte foi usada

---

## Logs de Diagnóstico

Os logs mostram:
- ✅ Se produtoId foi encontrado
- ✅ Se categoria/marca vieram do item
- ✅ Se foi necessário buscar detalhes completos
- ✅ Estrutura completa dos dados recebidos

**Exemplo de log:**
```
[SyncTiny] 🔍 Processando item: {
  produtoId: "123456",
  categoria_do_item: "Roupas",
  marca_do_item: null
}
[SyncTiny] 🔍 Buscando detalhes completos do produto 123456 (categoria: Roupas, marca: não encontrada)...
[SyncTiny] ✅ Marca extraída dos detalhes para produto 123456: Nike
```

---

## Próximos Passos

1. **Testar sincronização** e verificar logs no console
2. **Verificar estrutura** dos dados recebidos
3. **Ajustar extração** se necessário baseado nos logs
4. **Otimizar** se uma alternativa for mais eficiente

---

## Documentação da API Tiny ERP

- **GET /produtos/{idProduto}**: https://erp.tiny.com.br/public-api/v3/swagger/index.html#/Produtos/GetProduto
- **Estrutura de resposta**: `{ categoria: { id, nome, caminhoCompleto }, marca: { id, nome }, ... }`

