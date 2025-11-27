# 📋 PLANO DE IMPLEMENTAÇÃO COMPLETA - NETLIFY FUNCTIONS

## 🎯 OBJETIVO

Implementar **COMPLETAMENTE** as Netlify Functions com **TODA** a lógica de sincronização:
- ✅ Dados completos de pedidos
- ✅ Dados completos de clientes  
- ✅ Dados completos de produtos
- ✅ Extração de tamanho, cor, categoria, marca, subcategoria
- ✅ UPDATE apenas quando houver mudanças
- ✅ Normalização de dados

---

## 📝 LISTA TODO COMPLETA

### **FASE 1: FUNÇÕES AUXILIARES** 🔧

#### **1.1 Função de Normalização**
- [ ] `normalizeTamanho(tamanho)` - Normalizar tamanhos para maiúscula (P, M, G, etc.)
- [ ] `normalizeCor(cor)` - Normalizar cores para maiúscula
- [ ] Funções de normalização de nomes, CPF, etc.

#### **1.2 Funções de Busca Completa**
- [ ] `fetchPedidoCompletoFromTiny(storeId, pedidoId)` - Buscar detalhes completos do pedido
- [ ] `fetchProdutoCompletoFromTiny(storeId, produtoId)` - Buscar detalhes completos do produto
- [ ] `fetchContatoCompletoFromTiny(storeId, contatoId)` - Buscar detalhes completos do contato

#### **1.3 Função de Proxy API**
- [ ] Adaptar `callERPAPI` para Node.js (usar proxy Netlify Function)

---

### **FASE 2: SINCRONIZAÇÃO DE PEDIDOS** 📦

#### **2.1 Busca de Pedidos**
- [ ] Buscar pedidos paginados do Tiny ERP
- [ ] Filtrar apenas pedidos FATURADOS (situacao = 1) e APROVADOS (situacao = 3)
- [ ] Suportar hard sync (desde 2010-01-01) e incremental

#### **2.2 Busca de Detalhes Completos**
- [ ] Para cada pedido, buscar detalhes completos via `GET /pedidos/{id}`
- [ ] Extrair `itens` completos dos detalhes
- [ ] Extrair informações do cliente
- [ ] Extrair informações do vendedor

#### **2.3 Processamento de Itens**
- [ ] Para cada item do pedido:
  - [ ] Extrair produto_id
  - [ ] Buscar detalhes completos do produto
  - [ ] Extrair tamanho, cor de variações
  - [ ] Extrair categoria, subcategoria, marca
  - [ ] Normalizar dados
  - [ ] Montar objeto completo do item

#### **2.4 Sincronização de Produtos**
- [ ] Para cada produto encontrado:
  - [ ] Verificar se já existe no banco
  - [ ] Buscar detalhes completos se não tiver dados completos
  - [ ] Fazer UPSERT apenas se houver mudanças
  - [ ] Salvar variações, categoria, marca, etc.

#### **2.5 Sincronização de Clientes**
- [ ] Para cada cliente do pedido:
  - [ ] Verificar se já existe no banco
  - [ ] Buscar detalhes completos se não tiver dados completos
  - [ ] Extrair data de nascimento, telefone, email
  - [ ] Fazer UPSERT apenas se houver mudanças

#### **2.6 Salvamento de Pedido**
- [ ] Preparar objeto completo do pedido com todos os dados
- [ ] Salvar `itens` como JSONB completo
- [ ] Fazer UPSERT apenas se houver mudanças
- [ ] Salvar relacionamentos (cliente_id, colaboradora_id)

---

### **FASE 3: SINCRONIZAÇÃO DE CLIENTES** 👥

#### **3.1 Busca de Clientes**
- [ ] Buscar clientes paginados do Tiny ERP
- [ ] Suportar hard sync (todos) e incremental

#### **3.2 Busca de Detalhes Completos**
- [ ] Para cada cliente, buscar detalhes completos via `GET /contatos/{id}`
- [ ] Extrair data de nascimento, telefone, celular, email
- [ ] Extrair endereço completo
- [ ] Extrair dados extras

#### **3.3 Processamento e Salvamento**
- [ ] Normalizar dados (CPF, telefone, etc.)
- [ ] Verificar se já existe no banco
- [ ] Fazer UPSERT apenas se houver mudanças
- [ ] Preservar dados existentes se novos dados não vierem

---

### **FASE 4: LÓGICA DE UPDATE INTELIGENTE** 🧠

#### **4.1 Verificação de Mudanças**
- [ ] Comparar dados existentes com novos dados
- [ ] Identificar campos que mudaram
- [ ] Só fazer UPDATE se houver mudanças reais

#### **4.2 Preservação de Dados**
- [ ] Não sobrescrever dados existentes com null
- [ ] Priorizar dados completos sobre dados incompletos
- [ ] Manter dados que já existem se novos não vierem

---

### **FASE 5: TRATAMENTO DE ERROS E LOGS** 📊

#### **5.1 Logging Detalhado**
- [ ] Log de cada etapa do processo
- [ ] Log de erros com contexto completo
- [ ] Log de estatísticas (quantos sincronizados, atualizados, erros)

#### **5.2 Tratamento de Erros**
- [ ] Try/catch em cada etapa crítica
- [ ] Continuar processamento mesmo se um item falhar
- [ ] Retornar estatísticas de sucesso/erro

---

### **FASE 6: OTIMIZAÇÕES** ⚡

#### **6.1 Cache**
- [ ] Cache de produtos já buscados
- [ ] Cache de clientes já buscados
- [ ] Evitar requisições duplicadas

#### **6.2 Performance**
- [ ] Processar itens em paralelo quando possível
- [ ] Limitar número de requisições simultâneas
- [ ] Batch de upserts quando possível

---

## 📁 ESTRUTURA DE ARQUIVOS

```
netlify/functions/
├── sync-tiny-orders-background.js     ← IMPLEMENTAR COMPLETO
├── sync-tiny-contacts-background.js   ← IMPLEMENTAR COMPLETO
├── erp-api-proxy.js                   ← JÁ EXISTE (usar)
└── utils/
    ├── normalization.js                ← CRIAR
    ├── fetch-helpers.js                ← CRIAR
    └── update-logic.js                 ← CRIAR
```

---

## 🔧 FUNÇÕES PRINCIPAIS A IMPLEMENTAR

### **1. sync-tiny-orders-background.js**

```javascript
exports.handler = async (event, context) => {
  // 1. Validação inicial
  // 2. Buscar integração da loja
  // 3. Buscar pedidos paginados
  // 4. Para cada pedido:
  //    a. Buscar detalhes completos
  //    b. Processar itens
  //    c. Sincronizar produtos
  //    d. Sincronizar clientes
  //    e. Salvar pedido completo
  // 5. Retornar estatísticas
}
```

### **2. sync-tiny-contacts-background.js**

```javascript
exports.handler = async (event, context) => {
  // 1. Validação inicial
  // 2. Buscar integração da loja
  // 3. Buscar clientes paginados
  // 4. Para cada cliente:
  //    a. Buscar detalhes completos
  //    b. Normalizar dados
  //    c. Fazer UPSERT (só se mudou)
  // 5. Retornar estatísticas
}
```

---

## 📊 FLUXO COMPLETO DE SINCRONIZAÇÃO DE PEDIDO

```
1. Buscar pedidos (GET /pedidos)
   ↓
2. Filtrar apenas FATURADOS e APROVADOS
   ↓
3. Para cada pedido:
   ↓
   a. Buscar detalhes completos (GET /pedidos/{id})
      - Extrair itens
      - Extrair cliente
      - Extrair vendedor
   ↓
   b. Para cada item:
      - Extrair produto_id
      - Buscar detalhes do produto (GET /produtos/{id})
      - Extrair tamanho, cor de variações
      - Extrair categoria, marca
      - Normalizar dados
   ↓
   c. Sincronizar cliente:
      - Buscar detalhes completos (GET /contatos/{id})
      - Extrair data nascimento, telefone
      - Fazer UPSERT (só se mudou)
   ↓
   d. Sincronizar produtos:
      - Fazer UPSERT de cada produto (só se mudou)
   ↓
   e. Salvar pedido completo:
      - Montar objeto com todos os dados
      - Salvar itens como JSONB
      - Fazer UPSERT (só se mudou)
```

---

## ✅ CHECKLIST FINAL

- [ ] Todas as funções auxiliares implementadas
- [ ] Busca de detalhes completos de pedidos
- [ ] Processamento completo de itens
- [ ] Extração de tamanho, cor, categoria, marca
- [ ] Sincronização completa de produtos
- [ ] Sincronização completa de clientes
- [ ] Lógica de UPDATE inteligente
- [ ] Normalização de dados
- [ ] Tratamento de erros robusto
- [ ] Logging detalhado
- [ ] Testes realizados

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Criar estrutura de arquivos
2. ✅ Implementar funções auxiliares
3. ✅ Implementar sync-tiny-orders-background.js completo
4. ✅ Implementar sync-tiny-contacts-background.js completo
5. ✅ Testar sincronização incremental
6. ✅ Testar hard sync
7. ✅ Verificar dados no banco
8. ✅ Ajustar conforme necessário

