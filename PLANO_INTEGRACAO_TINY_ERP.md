# 📋 Plano de Integração Tiny ERP - 15 Passos

## 🎯 Objetivo
Sincronizar pedidos de venda (aprovados/faturados) e clientes do Tiny ERP para gerar relatórios por categorias e subcategorias.

**Foco:** Pedidos de venda e clientes  
**NÃO sincronizar:** Produtos, Estoque

**Documentação Oficial:** https://erp.tiny.com.br/public-api/v3/swagger/index.html

---

## ✅ Passo 1: Consultar Documentação Oficial
- [x] Acessar Swagger: https://erp.tiny.com.br/public-api/v3/swagger/index.html
- [x] Identificar endpoints corretos para pedidos
- [x] Identificar endpoints corretos para contatos
- [x] Verificar formato de requisições/respostas
- [x] Verificar filtros disponíveis (status, datas, etc)

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 2: Corrigir Endpoint de Teste
- [x] Alterar `testERPConnection` para testar endpoint de pedidos
- [x] Remover teste de produtos (não é necessário)
- [x] Testar conexão com endpoint `/pedidos`

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 3: Criar Função de Sincronização de Pedidos
- [x] Criar `src/lib/erp/syncTiny.ts`
- [x] Implementar `syncTinyOrders()` com filtro de status
- [x] Filtrar apenas pedidos 'faturado' (vendidos)
- [x] Mapear dados do Tiny para `tiny_orders`
- [x] Incluir itens com categorias/subcategorias
- [x] Salvar dados do cliente junto com pedido

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 4: Criar Função de Sincronização de Clientes
- [x] Implementar `syncTinyContacts()` em `syncTiny.ts`
- [x] Sincronizar clientes automaticamente ao sincronizar pedidos
- [x] Mapear dados do Tiny para `tiny_contacts`
- [x] Salvar dados completos do cliente

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 5: Adicionar Botão de Sincronização no Painel Dev
- [x] Adicionar botão "Sincronizar Pedidos" em `/dev/erp-config`
- [x] Conectar botão com `syncTinyOrders()`
- [x] Mostrar feedback visual (loading, toast)
- [x] Atualizar `last_sync_at` após sincronização

**Status:** ✅ **COMPLETO**

---

## ⏳ Passo 6: Verificar e Corrigir Endpoints da API v3
- [ ] Consultar Swagger para confirmar endpoints corretos
- [ ] Verificar se `/pedidos` está correto ou se é `/vendas`
- [ ] Verificar formato de requisição (GET vs POST)
- [ ] Verificar parâmetros de filtro (status, datas)
- [ ] Testar endpoint real e ajustar código

**Status:** ⏳ **PENDENTE**

---

## ✅ Passo 7: Implementar Paginação na Sincronização
- [x] Adicionar lógica de paginação para buscar todos os pedidos
- [x] Implementar loop para buscar múltiplas páginas
- [x] Adicionar limite máximo de registros por sincronização (maxPages)
- [x] Logs de progresso por página
- [x] Detecção automática de fim de paginação

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 8: Mapear Categorias e Subcategorias dos Itens
- [x] Extrair categorias/subcategorias dos itens do pedido
- [x] Suporte para múltiplos formatos (categoria, categoria_produto, categoria_id, produto.categoria)
- [x] Salvar categorias mapeadas nos itens (JSON)
- [x] Preservar dados originais para referência
- [x] Categorias disponíveis para relatórios

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 9: Criar Logs de Sincronização Detalhados
- [x] Melhorar logs em `erp_sync_logs`
- [x] Adicionar contadores (pedidos novos, atualizados, erros)
- [x] Salvar período sincronizado (data início/fim)
- [x] Adicionar tempo de execução (ms)
- [x] Salvar último ID sincronizado (proteção extra)
- [x] Detalhes de erros (primeiros 5)

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 10: Implementar Sincronização Incremental
- [x] Sincronizar apenas pedidos novos/atualizados desde última sync
- [x] Usar `data_pedido` para filtrar por período
- [x] Proteção extra: usar último ID sincronizado (além da data)
- [x] Evitar duplicação de dados
- [x] Otimizar performance

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 10.5: Adicionar Identificação de Vendedora
- [x] Adicionar campo `colaboradora_id` em `tiny_orders`
- [x] Adicionar campos `vendedor_tiny_id` e `vendedor_tiny_nome`
- [x] Tentar matching automático vendedor Tiny → colaboradora sistema
- [x] Preparar estrutura para integração com cashback e metas

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 11: Criar Componente para Visualizar Pedidos Sincronizados
- [x] Criar `src/components/erp/TinyOrdersList.tsx`
- [x] Listar pedidos de `tiny_orders` por loja
- [x] Mostrar dados principais (número, data, cliente, valor)
- [x] Filtrar por status, data, cliente

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 12: Criar Componente para Visualizar Clientes Sincronizados
- [x] Criar `src/components/erp/TinyContactsList.tsx`
- [x] Listar clientes de `tiny_contacts` por loja
- [x] Mostrar dados principais (nome, CPF/CNPJ, email, telefone)
- [x] Filtrar por tipo, nome, CPF/CNPJ

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 13: Criar Página de Relatórios por Categorias
- [x] Criar `src/pages/erp/CategoryReports.tsx`
- [x] Agrupar vendas por categoria/subcategoria
- [x] Mostrar totais, quantidades, ticket médio
- [x] Tabela detalhada de vendas por categoria
- [x] Filtros por período, loja

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 14: Criar Dashboard ERP para Loja
- [x] Criar `src/pages/erp/ERPDashboard.tsx`
- [x] Integrar componentes de pedidos e clientes
- [x] Mostrar KPIs (total vendas, pedidos sincronizados, etc)
- [x] Botão para sincronização manual
- [x] Status da última sincronização

**Status:** ✅ **COMPLETO**

---

## ✅ Passo 15: Implementar Sincronização Automática
- [x] Criar Netlify Function `sync-erp-orders.js`
- [x] Função pronta para agendamento (diária, semanal)
- [x] Suporte a autenticação via secret key
- [x] Processa todas as lojas com integração ativa
- [x] Retorna resultados detalhados

**Status:** ✅ **COMPLETO**

**Nota:** Para agendar a sincronização automática, configure no `netlify.toml`:
```toml
[[plugins]]
  package = "@netlify/plugin-scheduled-functions"
```

E defina a variável de ambiente `ERP_SYNC_SECRET` no Netlify.

---

## 📝 Notas Importantes

- **Sempre consultar documentação oficial:** https://erp.tiny.com.br/public-api/v3/swagger/index.html
- **Foco em pedidos e clientes:** Não implementar produtos/estoque
- **Categorias/Subcategorias:** Essenciais para relatórios
- **Testar cada passo:** Verificar funcionamento antes de prosseguir
- **Isolamento:** Novos arquivos em `/erp/` ou `/dev/`, não alterar código existente

---

## 🚀 Próximos Passos Imediatos

1. **Passo 6:** Verificar endpoints corretos na documentação
2. **Passo 7:** Implementar paginação
3. **Passo 8:** Mapear categorias/subcategorias
4. **Passo 9:** Melhorar logs
5. **Passo 10:** Sincronização incremental

