# 📋 TODO COMPLETA - IMPLEMENTAÇÃO NETLIFY FUNCTIONS

## 🎯 OBJETIVO

Implementar **COMPLETAMENTE** as Netlify Functions com **TODA** a lógica de sincronização:
- ✅ Dados completos de pedidos, clientes, produtos
- ✅ Extração de tamanho, cor, categoria, marca, subcategoria
- ✅ UPDATE apenas quando houver mudanças
- ✅ Normalização de dados
- ✅ Tratamento de erros robusto

---

## ✅ FASE 1: FUNÇÕES AUXILIARES

### **1.1 Arquivo: `netlify/functions/utils/normalization.js`**
- [ ] `normalizeTamanho(tamanho)` - Normalizar para maiúscula (P, M, G, etc.)
- [ ] `normalizeCor(cor)` - Normalizar para maiúscula
- [ ] Lista de tamanhos válidos

### **1.2 Arquivo: `netlify/functions/utils/fetch-helpers.js`**
- [ ] `callERPAPI(storeId, endpoint, params)` - Wrapper para proxy Netlify Function
- [ ] `fetchPedidoCompletoFromTiny(storeId, pedidoId)` - Buscar detalhes completos
- [ ] `fetchProdutoCompletoFromTiny(storeId, produtoId)` - Buscar detalhes completos
- [ ] `fetchContatoCompletoFromTiny(storeId, contatoId)` - Buscar detalhes completos
- [ ] Cache para evitar requisições duplicadas

### **1.3 Arquivo: `netlify/functions/utils/update-logic.js`**
- [ ] `shouldUpdateOrder(existing, newData)` - Verificar se precisa atualizar pedido
- [ ] `shouldUpdateContact(existing, newData)` - Verificar se precisa atualizar contato
- [ ] `shouldUpdateProduct(existing, newData)` - Verificar se precisa atualizar produto
- [ ] `mergeDataPreservingExisting(existing, newData)` - Mesclar dados preservando existentes

---

## ✅ FASE 2: SINCRONIZAÇÃO DE PEDIDOS

### **2.1 Busca de Pedidos**
- [ ] Buscar pedidos paginados do Tiny ERP
- [ ] Filtrar apenas FATURADOS (situacao = 1) e APROVADOS (situacao = 3)
- [ ] Suportar hard sync (desde 2010-01-01) e incremental
- [ ] Calcular data de início automaticamente se não fornecida

### **2.2 Busca de Detalhes Completos de Cada Pedido**
- [ ] Para cada pedido, buscar detalhes via `GET /pedidos/{id}`
- [ ] Extrair `itens` completos dos detalhes
- [ ] Extrair informações do cliente
- [ ] Extrair informações do vendedor
- [ ] Extrair valor total (com múltiplas estratégias de fallback)

### **2.3 Processamento de Itens**
- [ ] Para cada item do pedido:
  - [ ] Extrair produto_id
  - [ ] Extrair tamanho, cor diretamente do item (se disponível)
  - [ ] Buscar detalhes completos do produto (GET /produtos/{id})
  - [ ] Extrair tamanho, cor de variações
  - [ ] Extrair categoria, subcategoria, marca
  - [ ] Normalizar tamanhos (maiúscula)
  - [ ] Normalizar cores (maiúscula)
  - [ ] Montar objeto completo do item com todos os dados

### **2.4 Sincronização de Produtos**
- [ ] Para cada produto encontrado:
  - [ ] Verificar se já existe no banco
  - [ ] Buscar detalhes completos se não tiver dados completos
  - [ ] Extrair categoria, marca, variações
  - [ ] Fazer UPSERT apenas se houver mudanças
  - [ ] Preservar dados existentes

### **2.5 Sincronização de Clientes**
- [ ] Para cada cliente do pedido:
  - [ ] Verificar se já existe no banco
  - [ ] Buscar detalhes completos via `GET /contatos/{id}` (SEMPRE para pedidos aprovados/faturados)
  - [ ] Extrair data de nascimento, telefone, celular, email
  - [ ] Normalizar CPF/CNPJ
  - [ ] Normalizar telefone
  - [ ] Fazer UPSERT apenas se houver mudanças
  - [ ] Preservar dados existentes (não sobrescrever com null)

### **2.6 Salvamento de Pedido Completo**
- [ ] Preparar objeto completo do pedido:
  - [ ] Todos os campos básicos
  - [ ] `itens` como JSONB completo (com todos os dados extraídos)
  - [ ] Relacionamentos (cliente_id, colaboradora_id se encontrada)
  - [ ] Valor total calculado corretamente
  - [ ] Data com hora completa preservada
- [ ] Verificar se pedido já existe
- [ ] Fazer UPDATE apenas se houver mudanças
- [ ] Fazer INSERT se for novo

---

## ✅ FASE 3: SINCRONIZAÇÃO DE CLIENTES

### **3.1 Busca de Clientes**
- [ ] Buscar clientes paginados do Tiny ERP
- [ ] Suportar hard sync (todos) e incremental
- [ ] Limite de páginas configurável

### **3.2 Busca de Detalhes Completos**
- [ ] Para cada cliente, buscar detalhes via `GET /contatos/{id}`
- [ ] Extrair data de nascimento, telefone, celular, email
- [ ] Extrair endereço completo
- [ ] Extrair dados extras

### **3.3 Processamento e Salvamento**
- [ ] Normalizar dados (CPF, telefone, etc.)
- [ ] Verificar se já existe no banco
- [ ] Comparar dados existentes com novos
- [ ] Fazer UPSERT apenas se houver mudanças
- [ ] Preservar dados existentes se novos não vierem

---

## ✅ FASE 4: LÓGICA DE UPDATE INTELIGENTE

### **4.1 Verificação de Mudanças**
- [ ] Comparar campos relevantes entre dados existentes e novos
- [ ] Identificar campos que mudaram
- [ ] Só fazer UPDATE se houver mudanças reais

### **4.2 Preservação de Dados**
- [ ] Não sobrescrever dados existentes com null
- [ ] Priorizar dados completos sobre dados incompletos
- [ ] Manter dados que já existem se novos não vierem
- [ ] Mesclar dados quando necessário

---

## ✅ FASE 5: TRATAMENTO DE ERROS E LOGS

### **5.1 Logging Detalhado**
- [ ] Log de cada etapa do processo
- [ ] Log de dados extraídos
- [ ] Log de erros com contexto completo
- [ ] Log de estatísticas (sincronizados, atualizados, erros)

### **5.2 Tratamento de Erros**
- [ ] Try/catch em cada etapa crítica
- [ ] Continuar processamento mesmo se um item falhar
- [ ] Retornar estatísticas de sucesso/erro
- [ ] Log de erros detalhado para debug

---

## ✅ FASE 6: OTIMIZAÇÕES

### **6.1 Cache**
- [ ] Cache de produtos já buscados
- [ ] Cache de clientes já buscados
- [ ] Cache de pedidos já processados
- [ ] Evitar requisições duplicadas

### **6.2 Performance**
- [ ] Processar itens em paralelo quando possível
- [ ] Limitar número de requisições simultâneas
- [ ] Batch de upserts quando possível
- [ ] Retornar resposta imediata para trabalhos longos

---

## 📁 ESTRUTURA DE ARQUIVOS

```
netlify/functions/
├── sync-tiny-orders-background.js      ← IMPLEMENTAR COMPLETO
├── sync-tiny-contacts-background.js    ← IMPLEMENTAR COMPLETO
├── erp-api-proxy.js                    ← JÁ EXISTE (usar)
└── utils/
    ├── normalization.js                 ← CRIAR
    ├── fetch-helpers.js                 ← CRIAR
    └── update-logic.js                  ← CRIAR
```

---

## 🎯 CHECKLIST FINAL

### **Funções Auxiliares:**
- [ ] normalization.js criado e testado
- [ ] fetch-helpers.js criado e testado
- [ ] update-logic.js criado e testado

### **Sincronização de Pedidos:**
- [ ] Busca de pedidos paginados
- [ ] Busca de detalhes completos
- [ ] Processamento de itens completo
- [ ] Extração de tamanho, cor, categoria, marca
- [ ] Sincronização de produtos
- [ ] Sincronização de clientes
- [ ] Salvamento de pedido completo

### **Sincronização de Clientes:**
- [ ] Busca de clientes paginados
- [ ] Busca de detalhes completos
- [ ] Processamento e salvamento

### **Lógica de UPDATE:**
- [ ] Verificação de mudanças
- [ ] Preservação de dados

### **Tratamento de Erros:**
- [ ] Logging detalhado
- [ ] Tratamento robusto de erros

### **Testes:**
- [ ] Testar sincronização incremental
- [ ] Testar hard sync (todos os pedidos)
- [ ] Testar hard sync (todos os clientes)
- [ ] Verificar dados salvos no banco
- [ ] Verificar relatórios funcionando

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. ✅ Criar estrutura de arquivos e funções auxiliares
2. ✅ Implementar normalization.js
3. ✅ Implementar fetch-helpers.js
4. ✅ Implementar update-logic.js
5. ✅ Implementar sync-tiny-orders-background.js completo
6. ✅ Implementar sync-tiny-contacts-background.js completo
7. ✅ Testar tudo
8. ✅ Ajustar conforme necessário

