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

## ⏳ Passo 7: Implementar Paginação na Sincronização
- [ ] Adicionar lógica de paginação para buscar todos os pedidos
- [ ] Implementar loop para buscar múltiplas páginas
- [ ] Adicionar limite máximo de registros por sincronização
- [ ] Mostrar progresso da sincronização

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 8: Mapear Categorias e Subcategorias dos Itens
- [ ] Extrair categorias/subcategorias dos itens do pedido
- [ ] Verificar estrutura de dados do Tiny para categorias
- [ ] Salvar categorias em campo separado ou em `dados_extras`
- [ ] Garantir que categorias estão disponíveis para relatórios

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 9: Criar Logs de Sincronização Detalhados
- [ ] Melhorar logs em `erp_sync_logs`
- [ ] Adicionar contadores (pedidos novos, atualizados, erros)
- [ ] Salvar período sincronizado (data início/fim)
- [ ] Adicionar tempo de execução

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 10: Implementar Sincronização Incremental
- [ ] Sincronizar apenas pedidos novos/atualizados desde última sync
- [ ] Usar `data_pedido` para filtrar por período
- [ ] Evitar duplicação de dados
- [ ] Otimizar performance

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 11: Criar Componente para Visualizar Pedidos Sincronizados
- [ ] Criar `src/components/erp/TinyOrdersList.tsx`
- [ ] Listar pedidos de `tiny_orders` por loja
- [ ] Mostrar dados principais (número, data, cliente, valor)
- [ ] Filtrar por status, data, cliente

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 12: Criar Componente para Visualizar Clientes Sincronizados
- [ ] Criar `src/components/erp/TinyContactsList.tsx`
- [ ] Listar clientes de `tiny_contacts` por loja
- [ ] Mostrar dados principais (nome, CPF/CNPJ, email, telefone)
- [ ] Filtrar por tipo, nome, CPF/CNPJ

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 13: Criar Página de Relatórios por Categorias
- [ ] Criar `src/pages/erp/CategoryReports.tsx`
- [ ] Agrupar vendas por categoria/subcategoria
- [ ] Mostrar totais, quantidades, ticket médio
- [ ] Gráficos de vendas por categoria
- [ ] Filtros por período, loja

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 14: Criar Dashboard ERP para Loja
- [ ] Criar `src/pages/erp/ERPDashboard.tsx`
- [ ] Integrar componentes de pedidos e clientes
- [ ] Mostrar KPIs (total vendas, pedidos sincronizados, etc)
- [ ] Botão para sincronização manual
- [ ] Status da última sincronização

**Status:** ⏳ **PENDENTE**

---

## ⏳ Passo 15: Implementar Sincronização Automática (Opcional)
- [ ] Criar Netlify Function ou Edge Function
- [ ] Agendar sincronização periódica (diária, semanal)
- [ ] Enviar notificações em caso de erro
- [ ] Dashboard de monitoramento

**Status:** ⏳ **PENDENTE**

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

