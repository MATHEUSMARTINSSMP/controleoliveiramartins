# Plano de Implementação do Sistema CRM

## 📋 Análise do Estado Atual

### ✅ O que já está implementado:
1. **Componentes UI criados:**
   - `CRMLojaView.tsx` - Interface básica para loja
   - `CRMStoreConfig.tsx` - Configuração de ativar/desativar CRM por loja
   - `CRMManagement.tsx` - Gestão global de CRM no admin

2. **Estrutura de dados:**
   - Campo `crm_ativo` na tabela `stores` (já existe no código)
   - Componente tenta usar tabela `crm_contacts` (mas não existe ainda)

### ❌ O que está faltando:
1. **Tabelas no banco de dados:**
   - `crm_contacts` - Contatos do CRM
   - `crm_tasks` - Tarefas do CRM
   - `crm_commitments` - Compromissos agendados
   - `crm_post_sales` - Pós-vendas agendadas

2. **Conexão com banco de dados:**
   - `CRMLojaView` usa apenas estado local (não persiste)
   - `CRMManagement` usa dados de exemplo (não busca do banco)
   - Não há busca de aniversariantes do banco

3. **Funcionalidades:**
   - Verificação de `crm_ativo` no `LojaDashboard` para mostrar/ocultar aba
   - Criação automática de pós-vendas ao registrar vendas
   - Busca de aniversariantes a partir de `tiny_contacts` ou `crm_contacts`
   - Notificações e lembretes

4. **Configuração unificada de módulos:**
   - Card único para ligar/desligar todos os módulos (Cashback, CRM, ERP)
   - Explicação de cada módulo

## 🎯 Plano de Implementação

### Fase 1: Estrutura do Banco de Dados ✅
- [x] Criar migration com todas as tabelas CRM
- [x] Adicionar RLS (Row Level Security)
- [x] Adicionar índices para performance
- [x] Adicionar triggers para `updated_at`

### Fase 2: Conectar Componentes ao Banco
- [ ] Conectar `CRMLojaView` ao banco:
  - [ ] Buscar tarefas do dia
  - [ ] Salvar novas tarefas
  - [ ] Marcar tarefas como concluídas
  - [ ] Buscar aniversariantes do dia
  - [ ] Buscar compromissos agendados
  - [ ] Buscar pós-vendas agendadas
  - [ ] Salvar novos compromissos

- [ ] Conectar `CRMManagement` ao banco:
  - [ ] Substituir dados de exemplo por dados reais
  - [ ] Implementar filtros por loja
  - [ ] Implementar busca avançada
  - [ ] Conectar CRUD de contatos

### Fase 3: Funcionalidades Avançadas
- [ ] Verificar `crm_ativo` no `LojaDashboard`
- [ ] Criar trigger/função para criar pós-vendas automaticamente ao registrar vendas
- [ ] Buscar aniversariantes de `tiny_contacts` ou `crm_contacts`
- [ ] Implementar notificações/lembretes (futuro)

### Fase 4: Configuração Unificada de Módulos
- [ ] Criar componente `ModuleConfig` unificado
- [ ] Agrupar Cashback, CRM, ERP em um único card
- [ ] Adicionar descrições de cada módulo
- [ ] Permitir ativar/desativar por loja

### Fase 5: Melhorias e Robustez
- [ ] Adicionar validação de dados
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Feedback visual (toasts)
- [ ] Testes básicos

## 📝 Detalhamento das Funcionalidades

### 1. Tarefas do CRM
- **Criar:** Formulário para adicionar nova tarefa
- **Listar:** Mostrar tarefas pendentes do dia
- **Concluir:** Marcar tarefa como concluída
- **Filtrar:** Por prioridade, status, colaboradora

### 2. Aniversariantes
- **Buscar:** Aniversariantes do dia a partir de `tiny_contacts` ou `crm_contacts`
- **Mensagem:** Gerar mensagem padrão de aniversário
- **WhatsApp:** Link direto para enviar mensagem
- **Cupom:** Integrar com sistema de cupons (futuro)

### 3. Pós-Vendas
- **Criar automático:** Ao registrar venda, criar pós-venda agendada (7 dias depois)
- **Listar:** Mostrar pós-vendas agendadas
- **Concluir:** Marcar como concluída após contato
- **Detalhes:** Ver informações da venda original

### 4. Compromissos
- **Agendar:** Criar compromisso com cliente
- **Listar:** Mostrar compromissos do dia/semana
- **Tipos:** Ajuste, Follow-up, Venda, Outro
- **Notificações:** Lembretes (futuro)

### 5. Contatos
- **CRUD completo:** Criar, ler, atualizar, deletar
- **Busca:** Por nome, email, telefone
- **Vínculo:** Com vendas, tarefas, compromissos

## 🔧 Melhorias Sugeridas

### Curto Prazo:
1. ✅ Criar tabelas no banco
2. Conectar componentes ao banco
3. Verificar `crm_ativo` no dashboard
4. Criar componente unificado de módulos

### Médio Prazo:
1. Criação automática de pós-vendas
2. Busca de aniversariantes
3. Filtros e busca avançada
4. Validação e tratamento de erros

### Longo Prazo:
1. Notificações e lembretes
2. Integração com WhatsApp (envio automático)
3. Relatórios de CRM
4. Dashboard de métricas CRM

## 📊 Estrutura de Dados

### crm_contacts
- id, store_id, nome, email, telefone, data_nascimento, observacoes

### crm_tasks
- id, store_id, colaboradora_id, cliente_id, cliente_nome, title, description, due_date, priority, status

### crm_commitments
- id, store_id, colaboradora_id, cliente_id, cliente_nome, type, scheduled_date, notes, status

### crm_post_sales
- id, store_id, sale_id, tiny_order_id, cliente_id, cliente_nome, colaboradora_id, sale_date, scheduled_follow_up, details, status

## 🚀 Próximos Passos Imediatos

1. ✅ Criar migration SQL
2. Conectar CRMLojaView ao banco
3. Conectar CRMManagement ao banco
4. Verificar crm_ativo no LojaDashboard
5. Criar componente unificado de módulos

