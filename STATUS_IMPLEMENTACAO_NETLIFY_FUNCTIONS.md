# 📋 STATUS DA IMPLEMENTAÇÃO - NETLIFY FUNCTIONS

## ✅ O QUE FOI CONCLUÍDO

### **1. Correção do Horário Fixo** ✅
- ✅ Corrigido para usar hora real do `pedidoCompleto.dataCriacao`
- ✅ Prioriza múltiplas fontes de data com hora antes de usar `00:00:00`
- ✅ Arquivo: `src/lib/erp/syncTiny.ts` (linhas 1449-1600)

### **2. Funções Auxiliares Criadas** ✅
- ✅ `netlify/functions/utils/normalization.js` - Normalização completa
- ✅ `netlify/functions/utils/erpApiHelpers.js` - Helpers para API
- ✅ `netlify/functions/utils/updateLogic.js` - Lógica de UPDATE inteligente

### **3. Estrutura Base das Netlify Functions** ✅
- ✅ `netlify/functions/sync-tiny-orders-background.js` - Estrutura básica
- ✅ `netlify/functions/sync-tiny-contacts-background.js` - Placeholder

---

## ⏳ O QUE FALTA IMPLEMENTAR

### **Netlify Function: sync-tiny-orders-background.js**

#### **TAREFA 1: Buscar Detalhes Completos de Pedidos** ⏳
- [ ] Para cada pedido, chamar `fetchPedidoCompletoFromTiny()` 
- [ ] Extrair `itens` completos dos detalhes
- [ ] Extrair data/hora completa do pedido

#### **TAREFA 2: Processar Itens Completo** ⏳
- [ ] Para cada item:
  - [ ] Extrair produto_id, quantidade, valorUnitario
  - [ ] Extrair tamanho/cor diretamente do item (se disponível)
  - [ ] Buscar detalhes completos do produto
  - [ ] Extrair tamanho/cor de variações
  - [ ] Extrair categoria, subcategoria, marca
  - [ ] Normalizar tamanhos (maiúscula)
  - [ ] Normalizar cores (maiúscula)

#### **TAREFA 3: Sincronizar Clientes** ⏳
- [ ] Para cada cliente do pedido:
  - [ ] Verificar se já existe no banco
  - [ ] Buscar detalhes completos via `GET /contatos/{id}`
  - [ ] Extrair data nascimento, telefone, celular, email
  - [ ] Normalizar CPF/CNPJ, telefone
  - [ ] Fazer UPSERT preservando dados existentes

#### **TAREFA 4: Sincronizar Vendedores/Colaboradoras** ⏳
- [ ] Buscar colaboradora pelo vendedor (CPF, email, nome)
- [ ] Associar `colaboradora_id` ao pedido

#### **TAREFA 5: Salvar Pedido Completo** ⏳
- [ ] Preparar objeto completo com:
  - [ ] Todos os campos básicos
  - [ ] `itens` como JSONB completo
  - [ ] Relacionamentos (cliente_id, colaboradora_id)
  - [ ] Valor total calculado corretamente
  - [ ] Data com hora completa
- [ ] Verificar se pedido já existe
- [ ] Fazer UPDATE apenas se houver mudanças

---

### **Netlify Function: sync-tiny-contacts-background.js**

#### **TAREFA 6: Buscar Clientes Paginados** ⏳
- [ ] Buscar clientes do Tiny ERP com paginação
- [ ] Filtrar apenas clientes (excluir fornecedores)
- [ ] Suportar hard sync (todos) e incremental

#### **TAREFA 7: Buscar Detalhes Completos** ⏳
- [ ] Para cada cliente, buscar detalhes via `GET /contatos/{id}`
- [ ] Extrair data nascimento, telefone, celular, email
- [ ] Extrair endereço completo

#### **TAREFA 8: Processar e Salvar** ⏳
- [ ] Normalizar dados (CPF, telefone, etc.)
- [ ] Verificar se já existe no banco
- [ ] Comparar dados existentes com novos
- [ ] Fazer UPSERT apenas se houver mudanças
- [ ] Preservar dados existentes se novos não vierem

---

## 📖 REFERÊNCIA: Lógica Completa no Frontend

A lógica completa já está implementada em:
- **Arquivo:** `src/lib/erp/syncTiny.ts`
- **Funções principais:**
  - `syncTinyOrders()` - Sincronização de pedidos (linhas ~521-2100)
  - `syncTinyContact()` - Sincronização de cliente individual (linhas ~2294-2600)
  - `syncTinyContacts()` - Sincronização de todos os clientes (linhas ~2700-3000)
  - `fetchPedidoCompletoFromTiny()` - Buscar detalhes do pedido (linhas ~2238-2285)
  - `fetchProdutoCompletoFromTiny()` - Buscar detalhes do produto (linhas ~2100-2229)
  - `fetchContatoCompletoFromTiny()` - Buscar detalhes do contato (linhas ~241-309)
  - `findCollaboratorByVendedor()` - Buscar colaboradora (linhas ~362-510)

### **Extração de Itens (linhas ~814-1360)**
- Extração completa de tamanho, cor, categoria, marca, subcategoria
- Busca de detalhes completos do produto
- Extração de variações (grade)
- Normalização de dados
- Múltiplas estratégias de fallback

### **Processamento de Data/Hora (linhas ~1449-1600)**
- Prioriza `pedidoCompleto.dataCriacao`
- Tenta múltiplas fontes antes de usar `00:00:00`
- Preserva hora real quando disponível

---

## 🎯 PRÓXIMOS PASSOS

1. **Adaptar lógica do frontend para Node.js** nas Netlify Functions
2. **Usar funções auxiliares criadas** (`normalization.js`, `erpApiHelpers.js`, `updateLogic.js`)
3. **Implementar tratamento de erros robusto**
4. **Adicionar logging detalhado**
5. **Testar sincronização incremental e hard sync**

---

## 📝 NOTAS IMPORTANTES

### **Diferenças Frontend vs Netlify Function**
- Frontend usa TypeScript, Netlify Functions usa JavaScript
- Frontend tem acesso direto ao Supabase client, Netlify Functions também
- Frontend usa `callERPAPI()` do `erpIntegrations.ts`, Netlify Functions usa `erpApiHelpers.js`

### **Cache**
- Frontend tem cache global para produtos/contatos
- Netlify Functions devem ter cache por execução (não persistente entre chamadas)

### **Async/Await**
- Ambas usam async/await normalmente
- Netlify Functions têm timeout limitado (10s para free tier, 26s para paid)

---

## 🔗 ARQUIVOS RELACIONADOS

- `src/lib/erp/syncTiny.ts` - Lógica completa de referência
- `netlify/functions/sync-tiny-orders-background.js` - Implementar
- `netlify/functions/sync-tiny-contacts-background.js` - Implementar
- `netlify/functions/utils/normalization.js` - ✅ Criado
- `netlify/functions/utils/erpApiHelpers.js` - ✅ Criado
- `netlify/functions/utils/updateLogic.js` - ✅ Criado

---

## ✅ CHECKLIST FINAL

- [ ] sync-tiny-orders-background.js completamente implementado
- [ ] sync-tiny-contacts-background.js completamente implementado
- [ ] Testes realizados
- [ ] Logs verificados
- [ ] Dados salvos corretamente no banco
- [ ] Relatórios funcionando com novos dados

