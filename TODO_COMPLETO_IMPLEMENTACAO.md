# 📋 TODO COMPLETO - IMPLEMENTAÇÃO CASHBACK E INTELIGÊNCIA DE PRODUTO

## 🎯 PARTE 1: PROGRAMA DE CASHBACK (PRIORIDADE ALTA)

### 1.1 Verificação e Ajuste do Banco de Dados
- [ ] Verificar estrutura atual das tabelas de cashback
- [ ] Verificar se `tiny_orders` tem campos necessários para cashback (cliente_id, valor_total, etc)
- [ ] Criar/ajustar tabela `cashback_transactions` para suportar clientes (não só colaboradoras)
- [ ] Adicionar campos necessários: `cliente_id`, `tiny_order_id`, `data_liberacao`, `data_expiracao`
- [ ] Criar SQL de migração completa

### 1.2 Página de Gestão de Cashback
- [ ] Criar rota `/erp/cashback-management` no App.tsx
- [ ] Criar componente `CashbackManagement.tsx` completo
- [ ] Implementar tabs: "Visão Geral", "Histórico", "Expirando", "Expirado", "Configurações"
- [ ] Design bonito, organizado e amigável
- [ ] Cards com KPIs (total cashback, disponível, expirando, expirado)

### 1.3 Funcionalidades de Visualização
- [ ] Lista de clientes com cashback (colapsável)
- [ ] Ao expandir cliente, mostrar histórico completo
- [ ] Filtros: por loja, período, status (disponível, expirando, expirado)
- [ ] Busca por nome do cliente
- [ ] Ordenação por data, valor, cliente

### 1.4 Funcionalidade de Renovação
- [ ] Botão "Renovar" em cashback expirando/expirado
- [ ] Modal de confirmação
- [ ] Atualizar `data_expiracao` conforme configurações
- [ ] Marcar como renovado (`renovado = true`)
- [ ] Feedback visual de sucesso

### 1.5 Preparação para Envio de Mensagem
- [ ] Campo "Enviar Mensagem" (desabilitado por enquanto)
- [ ] Placeholder de template de mensagem
- [ ] Estrutura preparada para integração futura
- [ ] Comentário no código indicando que será implementado depois

### 1.6 Configurações Funcionais
- [ ] Fazer `CashbackSettings.tsx` funcionar 100%
- [ ] Salvar configurações no banco
- [ ] Carregar configurações ao abrir
- [ ] Validação de campos
- [ ] Feedback de sucesso/erro

### 1.7 Trigger de Geração Automática
- [ ] Criar função PostgreSQL `calculate_cashback_for_tiny_order()`
- [ ] Trigger após INSERT em `tiny_orders`
- [ ] Buscar configurações (global ou por loja)
- [ ] Calcular cashback baseado em `percentual_cashback`
- [ ] Calcular `data_liberacao` (data_pedido + prazo_liberacao_dias)
- [ ] Calcular `data_expiracao` (data_liberacao + prazo_expiracao_dias)
- [ ] Inserir em `cashback_transactions` com tipo 'EARNED'
- [ ] Atualizar `cashback_balance` do cliente

### 1.8 Integração com Tiny Orders
- [ ] Verificar se `tiny_orders` tem `cliente_id` (FK para `tiny_contacts`)
- [ ] Garantir que cashback é gerado apenas para pedidos faturados/aprovados
- [ ] Testar geração automática

---

## 🎯 PARTE 2: INTELIGÊNCIA DE PRODUTO (PRIORIDADE ALTA)

### 2.1 Correção de Extração de Cor e Tamanho
- [ ] Verificar documentação oficial do Tiny sobre "variações"
- [ ] Ajustar `syncTiny.ts` para extrair cor e tamanho de `variacoes`
- [ ] Testar com produtos reais
- [ ] Garantir que `tamanho` e `cor` são salvos em `tiny_orders.itens`
- [ ] Verificar se dados estão sendo salvos corretamente no banco

### 2.2 Análises Solicitadas - Implementação
- [ ] **Qual tamanho vende mais de cada marca**
  - [ ] Query agregada por marca e tamanho
  - [ ] Tabela ordenada por quantidade
  - [ ] Gráfico de barras
  
- [ ] **Qual tamanho vende mais de cada categoria**
  - [ ] Query agregada por categoria e tamanho
  - [ ] Tabela ordenada por quantidade
  - [ ] Gráfico de barras

- [ ] **Qual a tendência de venda de cada tamanho para cada marca**
  - [ ] Análise temporal (últimos 30, 60, 90 dias)
  - [ ] Gráfico de linha mostrando evolução
  - [ ] Identificar tendências (crescendo, estável, caindo)

- [ ] **Qual o ticket médio para cada tamanho**
  - [ ] Agregação por tamanho
  - [ ] Cálculo de ticket médio (valor_total / quantidade_pedidos)
  - [ ] Tabela e gráfico

- [ ] **Qual o ticket médio de cada marca**
  - [ ] Agregação por marca
  - [ ] Cálculo de ticket médio
  - [ ] Tabela e gráfico

- [ ] **Qual marca cada vendedor mais vende**
  - [ ] Agregação por vendedor e marca
  - [ ] Ranking por vendedor
  - [ ] Tabela e gráfico

- [ ] **Qual ticket médio de cada marca por vendedor**
  - [ ] Agregação por vendedor, marca
  - [ ] Cálculo de ticket médio
  - [ ] Tabela pivot

- [ ] **Qual horário de maior venda**
  - [ ] Extrair hora de `data_pedido` (se disponível) ou usar hora atual
  - [ ] Agrupar por hora do dia
  - [ ] Gráfico de barras mostrando vendas por hora
  - [ ] Identificar picos

- [ ] **Qual maior ticket médio por horário**
  - [ ] Agrupar por hora
  - [ ] Calcular ticket médio por hora
  - [ ] Gráfico mostrando ticket médio por hora

### 2.3 Visualizações Criativas
- [ ] Dashboard com cards de KPIs principais
- [ ] Gráficos interativos (Recharts)
- [ ] Filtros combináveis (período, loja, vendedor, marca, categoria, tamanho, cor)
- [ ] Exportação de dados (CSV)
- [ ] Comparação de períodos
- [ ] Heatmap de vendas (dia da semana x hora)

### 2.4 Melhorias na Página Existente
- [ ] Verificar se `ProductSalesIntelligence.tsx` está puxando cor e tamanho
- [ ] Adicionar novas análises solicitadas
- [ ] Organizar em tabs lógicos
- [ ] Melhorar performance (memoização, índices)

---

## 🎯 PARTE 3: VERIFICAÇÃO E AJUSTES DO BANCO DE DADOS

### 3.1 Verificação Completa
- [ ] Verificar se `cashback_transactions` suporta clientes (não só colaboradoras)
- [ ] Verificar se `cashback_balance` suporta clientes
- [ ] Verificar se `tiny_orders` tem todos os campos necessários
- [ ] Verificar se `tiny_orders.itens` tem `tamanho` e `cor`
- [ ] Verificar índices para performance

### 3.2 SQL de Migração
- [ ] Criar migração para ajustar `cashback_transactions` (adicionar `cliente_id`, `tiny_order_id`)
- [ ] Criar migração para ajustar `cashback_balance` (suportar clientes)
- [ ] Criar função `calculate_cashback_for_tiny_order()`
- [ ] Criar trigger `trigger_calculate_cashback_tiny_order`
- [ ] Criar índices necessários
- [ ] Testar migração

---

## 📊 ORDEM DE IMPLEMENTAÇÃO SUGERIDA

### FASE 1: Fundação (Banco de Dados)
1. Verificação e ajuste do banco (Parte 3.1)
2. SQL de migração (Parte 3.2)
3. Testar migração

### FASE 2: Cashback - Backend
4. Trigger de geração automática (Parte 1.7)
5. Integração com Tiny Orders (Parte 1.8)
6. Testar geração automática

### FASE 3: Cashback - Frontend
7. Página de gestão (Parte 1.2)
8. Funcionalidades de visualização (Parte 1.3)
9. Funcionalidade de renovação (Parte 1.4)
10. Configurações funcionais (Parte 1.6)
11. Preparação para mensagem (Parte 1.5)

### FASE 4: Inteligência de Produto
12. Correção de extração (Parte 2.1)
13. Implementar análises solicitadas (Parte 2.2)
14. Visualizações criativas (Parte 2.3)
15. Melhorias na página existente (Parte 2.4)

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Cashback
- [ ] Configurações salvam e carregam corretamente
- [ ] Cashback é gerado automaticamente em novas vendas
- [ ] Histórico mostra todas as transações
- [ ] Cashback expirando é identificado corretamente
- [ ] Cashback expirado é identificado corretamente
- [ ] Renovação funciona e atualiza data de expiração
- [ ] Clientes podem ser colapsados/expandidos
- [ ] Filtros funcionam corretamente

### Inteligência de Produto
- [ ] Cor e tamanho são extraídos corretamente
- [ ] Todas as análises solicitadas estão implementadas
- [ ] Gráficos são exibidos corretamente
- [ ] Filtros funcionam
- [ ] Performance é aceitável
- [ ] Dados estão corretos

---

## 📝 NOTAS IMPORTANTES

1. **Cashback para Clientes**: O sistema atual de cashback foi feito para colaboradoras. Precisamos adaptar para clientes também.

2. **Tiny Orders**: Verificar se `tiny_orders` tem `cliente_id` ou se precisamos fazer JOIN com `tiny_contacts`.

3. **Variações do Tiny**: A documentação oficial do Tiny deve ser consultada para entender a estrutura de `variacoes`.

4. **Performance**: Com muitas vendas, as queries podem ficar lentas. Considerar índices e paginação.

5. **Testes**: Testar com dados reais antes de considerar completo.

