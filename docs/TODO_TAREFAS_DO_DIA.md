# TODO: Funcionalidade Tarefas do Dia

## 📋 Visão Geral
Sistema completo de gerenciamento de tarefas diárias por turno/horário, permitindo que administradores configurem tarefas e colaboradoras marquem como concluídas.

---

## 🗄️ BACKEND - SQL Migrations

### 1. Tabela de Turnos (Shifts)
```sql
CREATE TABLE sistemaretiradas.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL, -- 'Manhã', 'Tarde', 'Noite', 'Integral'
  start_time TIME,
  end_time TIME,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Tabela de Tarefas (Daily Tasks)
```sql
CREATE TABLE sistemaretiradas.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  shift_id UUID REFERENCES sistemaretiradas.shifts(id),
  due_time TIME, -- Horário limite (opcional)
  is_active BOOLEAN DEFAULT true,
  is_recurring BOOLEAN DEFAULT false, -- Tarefa recorrente diária
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES sistemaretiradas.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Tabela de Execuções (Task Completions)
```sql
CREATE TABLE sistemaretiradas.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES sistemaretiradas.daily_tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES sistemaretiradas.profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Adicionar coluna tasks_ativo em stores
```sql
ALTER TABLE sistemaretiradas.stores 
ADD COLUMN IF NOT EXISTS tasks_ativo BOOLEAN DEFAULT false;
```

### 5. RLS Policies
- Admins podem gerenciar todas as tarefas da loja
- Colaboradoras podem ver tarefas da sua loja
- Colaboradoras podem marcar tarefas como completas
- Colaboradoras podem ver suas próprias execuções

### 6. Funções RPC
- `get_daily_tasks(store_id, date)` - Buscar tarefas do dia ordenadas por turno
- `complete_task(task_id, profile_id, notes)` - Marcar tarefa como completa
- `get_task_statistics(store_id, date)` - Estatísticas do dia
- `create_daily_task(...)` - Criar nova tarefa
- `update_daily_task(...)` - Atualizar tarefa
- `delete_daily_task(...)` - Deletar tarefa

---

## 🎨 FRONTEND - Admin Dashboard

### Componentes Principais

#### 1. AdminDailyTasksConfig.tsx
- Página principal de configuração de tarefas
- Toggle para ativar/desativar funcionalidade
- Lista de tarefas do dia atual
- Botão para criar nova tarefa
- Filtros e busca

#### 2. AdminTaskForm.tsx
- Formulário para criar/editar tarefa
- Campos: título, descrição, turno, horário limite
- Checkbox para tarefa recorrente
- Validações

#### 3. AdminTaskList.tsx
- Lista de tarefas agrupadas por turno
- Drag-and-drop para reordenar (opcional)
- Editar/Deletar tarefas
- Visualização por cards ou lista

#### 4. AdminShiftManager.tsx (Opcional)
- Gerenciar turnos customizados
- Criar/Editar/Deletar turnos

---

## 🏪 FRONTEND - Loja Dashboard

### Componentes Principais

#### 1. LojaTasksTab.tsx
- Nova aba dentro de "Configurações de Sistemas"
- Mostrar tarefas do dia atual
- Agrupadas por turno com divisão visual
- Estatísticas no final

#### 2. TaskCard.tsx
- Card individual de tarefa
- Checkbox para marcar como feita
- Mostrar horário limite
- Indicador visual de status (pendente/completa)
- Estilo riscado quando completa (mantendo legibilidade)

#### 3. TaskSection.tsx
- Seção por turno
- Header com nome do turno e horário
- Lista de tarefas do turno
- Contador de tarefas completas/total
- Cores diferentes por turno

#### 4. TaskStatistics.tsx
- Relatório no final da página
- Total de tarefas
- Tarefas completas
- Taxa de conclusão
- Ranking de colaboradoras (quem mais fez tarefas)
- Gráfico visual (opcional)

---

## 🎯 Funcionalidades Adicionais

### Visual
- ✅ Design moderno e futurista
- ✅ Gradientes sutis
- ✅ Animações suaves
- ✅ Cores diferenciadas por turno
- ✅ Ícones intuitivos
- ✅ Responsivo

### Interatividade
- ✅ Confirmação visual ao marcar tarefa
- ✅ Atualização em tempo real
- ✅ Notificação quando tarefa está próxima do limite
- ✅ Histórico de execuções
- ✅ Exportação de relatório

### UX
- ✅ Tudo na mesma página (sem navegação)
- ✅ Modularizado
- ✅ Fácil de usar
- ✅ Feedback claro

---

## 📊 Estrutura de Dados

### Turnos Padrão
1. **Manhã** - 06:00 às 12:00
2. **Tarde** - 12:00 às 18:00
3. **Noite** - 18:00 às 23:00
4. **Integral** - 00:00 às 23:59

### Exemplo de Tarefa
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "title": "Mandar mensagem de cashback",
  "description": "Enviar mensagens de cashback para clientes",
  "shift_id": "uuid-manha",
  "due_time": "10:00:00",
  "is_active": true,
  "is_recurring": true,
  "display_order": 1
}
```

---

## 🔄 Fluxo de Uso

### Admin
1. Acessa Admin Dashboard → Configurações → Tarefas
2. Cria tarefas do dia
3. Define turno e horário limite
4. Ativa/desativa funcionalidade por loja

### Colaboradora
1. Acessa Loja Dashboard → Configurações → Tarefas
2. Vê tarefas do dia agrupadas por turno
3. Marca tarefas como feitas (check)
4. Vê estatísticas no final

---

## ✅ Checklist de Implementação

- [ ] SQL Migrations criadas
- [ ] RLS Policies configuradas
- [ ] Funções RPC implementadas
- [ ] Componentes Admin criados
- [ ] Componentes Loja criados
- [ ] Hooks customizados criados
- [ ] Integração com Supabase Realtime
- [ ] Visual moderno aplicado
- [ ] Testes realizados
- [ ] Documentação atualizada

---

## 🚀 Próximos Passos

1. Criar migrations SQL
2. Criar componentes Admin
3. Criar componentes Loja
4. Implementar hooks
5. Aplicar estilos
6. Testar funcionalidades
7. Deploy

