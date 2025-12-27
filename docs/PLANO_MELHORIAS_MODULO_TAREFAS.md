# 🚀 Plano de Melhorias - Módulo de Tarefas (Visualização Calendário/Tabela)

**Data:** 2025-12-28  
**Objetivo:** Transformar o módulo de tarefas em uma visualização tipo calendário/tabela com dias da semana como colunas

---

## 📋 SUMÁRIO EXECUTIVO

### Status Atual:
- ✅ Sistema de tarefas básico implementado (`daily_tasks`, `task_completions`)
- ✅ Tarefas com turnos (`shifts`)
- ✅ Tarefas com horário (`due_time`)
- ✅ Sistema de conclusão de tarefas
- ⚠️ Visualização atual agrupa por turno (não por dia)
- ⚠️ Falta visualização em formato calendário/tabela

### Objetivo:
- 🎯 Visualização tipo calendário: **Colunas = Dias da Semana**, **Linhas = Tarefas**
- 🎯 Status visual: **PENDENTE**, **PENDENTE - ATRASADO**, **CONCLUÍDA**
- 🎯 Admin: CRUD completo, prioridades
- 🎯 Loja: Visualizar, concluir, indicar quem fez, marcar horário

---

## 🗄️ PARTE 1: MELHORIAS NO BANCO DE DADOS

### 1.1 Adicionar Campo `priority` à Tabela `daily_tasks`

**Migration:** `20251228000001_add_priority_to_daily_tasks.sql`

```sql
-- Adicionar coluna priority
ALTER TABLE sistemaretiradas.daily_tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MÉDIA' 
CHECK (priority IN ('ALTA', 'MÉDIA', 'BAIXA'));

COMMENT ON COLUMN sistemaretiradas.daily_tasks.priority IS 'Prioridade da tarefa: ALTA, MÉDIA ou BAIXA';

-- Criar índice para ordenação por prioridade
CREATE INDEX IF NOT EXISTS idx_daily_tasks_priority 
ON sistemaretiradas.daily_tasks(priority);
```

**Justificativa:** Permitir que admin marque prioridades nas tarefas (ALTA, MÉDIA, BAIXA)

---

### 1.2 Adicionar Campos de Status Detalhado em `task_completions`

**Migration:** `20251228000002_add_status_fields_to_task_completions.sql`

```sql
-- Adicionar campo para armazenar status calculado
-- Nota: Status será calculado dinamicamente, mas podemos adicionar campos auxiliares

-- Adicionar campo para quem completou (já existe como profile_id, mas vamos adicionar nome)
-- Isso será feito via JOIN, não precisa de coluna adicional

-- Adicionar campo para hora de conclusão (já existe completed_at, mas vamos garantir que está sendo usado)
```

**Nota:** Status será calculado dinamicamente:
- **PENDENTE**: `completed_at IS NULL` e `due_time > CURRENT_TIME`
- **PENDENTE - ATRASADO**: `completed_at IS NULL` e `due_time < CURRENT_TIME`
- **CONCLUÍDA**: `completed_at IS NOT NULL`

---

## 🎨 PARTE 2: COMPONENTE ADMIN (CRUD Completo)

### 2.1 Novo Componente: `AdminTasksCalendarView.tsx`

**Localização:** `src/components/admin/AdminTasksCalendarView.tsx`

**Funcionalidades:**
- ✅ Visualização em formato tabela: **Colunas = Dias da Semana** (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
- ✅ Linhas dinâmicas: Tarefas adicionadas conforme demanda
- ✅ Ordenação por horário (`due_time`) dentro de cada dia
- ✅ Indicador visual de prioridade (cores: ALTA=vermelho, MÉDIA=amarelo, BAIXA=verde)
- ✅ Navegação entre semanas (setas ← →)
- ✅ Filtro por loja
- ✅ Botão "Adicionar Tarefa" abre modal de criação

**Interface:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [← Semana Anterior]  Semana de 28/12 a 03/01  [Próxima Semana →]         │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│   Seg    │   Ter    │   Qua    │   Qui    │   Sex    │   Sáb    │   Dom    │
│  28/12   │  29/12   │  30/12   │  31/12   │  01/01   │  02/01   │  03/01   │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 10:00    │ 10:00    │ 10:00    │ 10:00    │ 10:00    │ 10:00    │ 10:00    │
│ 🔴 ALTA  │ 🔴 ALTA  │ 🔴 ALTA  │ 🔴 ALTA  │ 🔴 ALTA  │ 🔴 ALTA  │ 🔴 ALTA  │
│ Varrer   │ Varrer   │ Varrer   │ Varrer   │ Varrer   │ Varrer   │ Varrer   │
│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 11:00    │ 11:00    │ 11:00    │ 11:00    │ 11:00    │ 11:00    │ 11:00    │
│ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │
│ Espirrar │ Espirrar │ Espirrar │ Espirrar │ Espirrar │ Espirrar │ Espirrar │
│ Essência │ Essência │ Essência │ Essência │ Essência │ Essência │ Essência │
│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 12:00    │          │ 12:00    │          │ 12:00    │          │          │
│ 🟡 MÉDIA │          │ 🟡 MÉDIA │          │ 🟡 MÉDIA │          │          │
│ Aspirar  │          │ Aspirar  │          │ Aspirar  │          │          │
│ Provador │          │ Provador │          │ Provador │          │          │
│ [✏️] [🗑️]│          │ [✏️] [🗑️]│          │ [✏️] [🗑️]│          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 14:00    │ 14:00    │ 14:00    │ 14:00    │ 14:00    │          │          │
│ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │          │          │
│ Ligar    │ Ligar    │ Ligar    │ Ligar    │ Ligar    │          │          │
│ Clientes │ Clientes │ Clientes │ Clientes │ Clientes │          │          │
│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│ [✏️] [🗑️]│          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Estrutura de Dados:**
```typescript
interface TaskCalendarCell {
  date: Date;
  tasks: DailyTask[];
}

interface DailyTask {
  id: string;
  title: string;
  due_time: string; // "10:00", "14:00", etc
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  is_recurring: boolean;
  shift_id: string | null;
  // ... outros campos
}
```

### 2.2 Modal de Criação/Edição: `TaskEditDialog.tsx`

**Campos do Formulário:**
- ✅ **Título** (obrigatório)
- ✅ **Descrição** (opcional)
- ✅ **Horário** (`due_time`) - input tipo time
- ✅ **Prioridade** - Select (ALTA, MÉDIA, BAIXA)
- ✅ **Turno** - Select (Manhã, Tarde, Noite, Integral)
- ✅ **Recorrente** - Switch (se true, aparece em todos os dias)
- ✅ **Dias da Semana** - Checkboxes (só aparece se não for recorrente)
  - [ ] Segunda
  - [ ] Terça
  - [ ] Quarta
  - [ ] Quinta
  - [ ] Sexta
  - [ ] Sábado
  - [ ] Domingo

**Lógica:**
- Se `is_recurring = true`: Tarefa aparece todos os dias
- Se `is_recurring = false`: Admin seleciona dias específicos (cria tarefas separadas)

### 2.3 Funcionalidades Admin:

1. **Adicionar Tarefa:**
   - Clica em "+" ou botão "Adicionar Tarefa"
   - Abre modal de criação
   - Define horário, prioridade, dias
   - Se recorrente: cria 1 tarefa que aparece todos os dias
   - Se não recorrente: cria N tarefas (uma para cada dia selecionado)

2. **Editar Tarefa:**
   - Clica em ✏️ na célula
   - Abre modal de edição
   - Edita todos os campos
   - Salva alterações

3. **Deletar Tarefa:**
   - Clica em 🗑️ na célula
   - Confirmação: "Deseja realmente excluir esta tarefa?"
   - Se recorrente: pergunta "Excluir apenas este dia ou todos os dias?"
   - Deleta tarefa

4. **Visualizar Prioridade:**
   - Badge colorido na célula:
     - 🔴 ALTA (vermelho)
     - 🟡 MÉDIA (amarelo)
     - 🟢 BAIXA (verde)

---

## 📱 PARTE 3: COMPONENTE LOJA (Visualização e Conclusão)

### 3.1 Novo Componente: `LojaTasksCalendarView.tsx`

**Localização:** `src/components/loja/LojaTasksCalendarView.tsx`

**Funcionalidades:**
- ✅ Visualização em formato tabela: **Colunas = Dias da Semana**
- ✅ Mostra apenas tarefas do dia atual por padrão
- ✅ Navegação entre dias (setas ← →)
- ✅ Status visual: PENDENTE, PENDENTE - ATRASADO, CONCLUÍDA
- ✅ Indicador de quem completou (se concluída)
- ✅ Botão "Marcar como Concluída"
- ✅ Mostra horário de conclusão

**Interface:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [← Dia Anterior]  Segunda-feira, 28 de Dezembro  [Próximo Dia →]         │
├─────────────────────────────────────────────────────────────────────────────┤
│  10:00  🔴 ALTA                                                             │
│  Varrer a Loja até 10H                                                     │
│  Status: ⚠️ PENDENTE - ATRASADO                                           │
│  [✅ Marcar como Concluída]                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  11:00  🟡 MÉDIA                                                            │
│  Espirrar Essência até 11H                                                 │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  12:00  🟡 MÉDIA                                                            │
│  Aspirar Provador até 12H                                                  │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ──────────────────── 13:00 ────────────────────                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  14:00  🟢 BAIXA                                                            │
│  Ligar para Clientes até 14H                                               │
│  Status: ✅ CONCLUÍDA                                                       │
│  Concluída por: Maria Silva às 14:15                                       │
│  [↩️ Desmarcar]                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  15:00  🟢 BAIXA                                                            │
│  Levar Roupas na Costureira até 15H                                        │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Modal de Conclusão: `TaskCompletionDialog.tsx`

**Quando colaboradora clica em "Marcar como Concluída":**
1. Abre modal com:
   - ✅ Título da tarefa
   - ✅ Horário previsto vs horário atual
   - ✅ Campo "Observações" (opcional)
   - ✅ Botão "Confirmar"

2. Ao confirmar:
   - Salva `task_completion` com:
     - `task_id`
     - `profile_id` (quem concluiu)
     - `completed_at` (hora atual)
     - `notes` (observações)
     - `completion_date` (data selecionada)

3. Atualiza visualização:
   - Status muda para "CONCLUÍDA"
   - Mostra nome de quem concluiu
   - Mostra horário de conclusão
   - Botão muda para "Desmarcar"

### 3.3 Funcionalidades Loja:

1. **Visualizar Tarefas:**
   - Mostra apenas tarefas do dia selecionado
   - Ordenadas por horário (`due_time`)
   - Agrupadas visualmente (linha divisória a cada hora diferente)

2. **Status Visual:**
   - ⏳ **PENDENTE**: Badge cinza/claro (tarefa não concluída, horário ainda não passou)
   - ⚠️ **PENDENTE - ATRASADO**: Badge vermelho/laranja (tarefa não concluída, horário já passou)
   - ✅ **CONCLUÍDA**: Badge verde (tarefa concluída)

3. **Marcar como Concluída:**
   - Clica em "Marcar como Concluída"
   - Abre modal de confirmação
   - Pode adicionar observações
   - Confirma → Tarefa fica marcada como concluída
   - Mostra nome de quem concluiu + horário

4. **Desmarcar:**
   - Se tarefa está concluída, mostra botão "Desmarcar"
   - Ao clicar, pergunta confirmação
   - Remove `task_completion`

5. **Navegação:**
   - Setas ← → para navegar entre dias
   - Mostra data atual no topo
   - Ao mudar dia, busca tarefas daquele dia

---

## 🔧 PARTE 4: FUNÇÕES RPC (Backend)

### 4.1 Função: `get_daily_tasks_by_week`

```sql
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks_by_week(
    p_store_id UUID,
    p_week_start DATE DEFAULT DATE_TRUNC('week', CURRENT_DATE)::DATE
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    due_time TIME,
    priority VARCHAR,
    is_recurring BOOLEAN,
    shift_id UUID,
    shift_name VARCHAR,
    task_date DATE, -- Data específica da tarefa
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    status VARCHAR -- 'PENDENTE', 'ATRASADO', 'CONCLUÍDA'
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.due_time,
        dt.priority,
        dt.is_recurring,
        dt.shift_id,
        s.name as shift_name,
        task_date,
        tc.profile_id as completed_by,
        tc.completed_at,
        tc.notes as completion_notes,
        CASE
            WHEN tc.completed_at IS NOT NULL THEN 'CONCLUÍDA'
            WHEN dt.due_time < CURRENT_TIME THEN 'ATRASADO'
            ELSE 'PENDENTE'
        END as status
    FROM (
        -- Tarefas recorrentes (aparecem todos os dias da semana)
        SELECT dt.*, date_series.task_date
        FROM sistemaretiradas.daily_tasks dt
        CROSS JOIN generate_series(
            p_week_start,
            p_week_start + INTERVAL '6 days',
            INTERVAL '1 day'
        ) as date_series(task_date)
        WHERE dt.store_id = p_store_id
          AND dt.is_active = true
          AND dt.is_recurring = true
        
        UNION ALL
        
        -- Tarefas não recorrentes (apenas no dia específico)
        SELECT dt.*, dt.created_at::DATE as task_date
        FROM sistemaretiradas.daily_tasks dt
        WHERE dt.store_id = p_store_id
          AND dt.is_active = true
          AND dt.is_recurring = false
          AND dt.created_at::DATE >= p_week_start
          AND dt.created_at::DATE <= p_week_start + INTERVAL '6 days'
    ) dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    LEFT JOIN sistemaretiradas.task_completions tc ON tc.task_id = dt.id 
        AND tc.completion_date = task_date
    ORDER BY task_date, dt.due_time NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.2 Função: `get_daily_tasks_by_date` (Já existe, mas vamos melhorar)

```sql
-- Atualizar função existente para incluir status e priority
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks(
    p_store_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    shift_id UUID,
    shift_name VARCHAR,
    shift_start_time TIME,
    shift_end_time TIME,
    shift_color VARCHAR,
    due_time TIME,
    priority VARCHAR, -- ✅ NOVO
    is_active BOOLEAN,
    is_recurring BOOLEAN,
    display_order INTEGER,
    created_at TIMESTAMPTZ,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    status VARCHAR -- ✅ NOVO: 'PENDENTE', 'ATRASADO', 'CONCLUÍDA'
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.id,
        dt.store_id,
        dt.title,
        dt.description,
        dt.shift_id,
        s.name as shift_name,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        s.color as shift_color,
        dt.due_time,
        dt.priority, -- ✅ NOVO
        dt.is_active,
        dt.is_recurring,
        dt.display_order,
        dt.created_at,
        tc.profile_id as completed_by,
        tc.completed_at,
        tc.notes as completion_notes,
        CASE -- ✅ NOVO: Calcula status
            WHEN tc.completed_at IS NOT NULL THEN 'CONCLUÍDA'
            WHEN dt.due_time IS NOT NULL AND dt.due_time < CURRENT_TIME THEN 'ATRASADO'
            ELSE 'PENDENTE'
        END as status
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    LEFT JOIN sistemaretiradas.task_completions tc ON tc.task_id = dt.id 
        AND tc.completion_date = p_date
    WHERE dt.store_id = p_store_id
      AND dt.is_active = true
      AND (
        dt.is_recurring = true -- Tarefas recorrentes aparecem todos os dias
        OR dt.created_at::DATE = p_date -- Tarefas não recorrentes apenas no dia criado
      )
    ORDER BY 
        dt.due_time NULLS LAST,
        dt.priority DESC, -- ✅ NOVO: Ordena por prioridade
        dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📝 PARTE 5: ESTRUTURA DE ARQUIVOS

### 5.1 Novos Componentes:

```
src/components/admin/
  ├── AdminTasksCalendarView.tsx (NOVO)
  ├── TaskEditDialog.tsx (NOVO)
  └── AdminDailyTasksConfig.tsx (MANTER - para configuração geral)

src/components/loja/
  ├── LojaTasksCalendarView.tsx (NOVO - substitui LojaTasksTab.tsx)
  ├── TaskCompletionDialog.tsx (NOVO)
  └── LojaTasksTab.tsx (DEPRECAR - manter por compatibilidade)

src/components/shared/
  └── TaskStatusBadge.tsx (NOVO - componente reutilizável de status)
```

### 5.2 Novos Hooks:

```
src/hooks/
  ├── useDailyTasks.ts (ATUALIZAR - adicionar status, priority)
  └── useTasksCalendar.ts (NOVO - hook específico para visualização calendário)
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Migration: Adicionar `priority` à `daily_tasks`
- [ ] Migration: Atualizar função `get_daily_tasks` com status
- [ ] Migration: Criar função `get_daily_tasks_by_week`
- [ ] Testar migrations

### Fase 2: Componentes Admin
- [ ] Criar `AdminTasksCalendarView.tsx`
- [ ] Criar `TaskEditDialog.tsx`
- [ ] Integrar com hook `useDailyTasks`
- [ ] Implementar CRUD (Create, Read, Update, Delete)
- [ ] Implementar visualização de prioridades
- [ ] Testar funcionalidades admin

### Fase 3: Componentes Loja
- [ ] Criar `LojaTasksCalendarView.tsx`
- [ ] Criar `TaskCompletionDialog.tsx`
- [ ] Criar `TaskStatusBadge.tsx`
- [ ] Implementar navegação entre dias
- [ ] Implementar marcação de conclusão
- [ ] Implementar visualização de status
- [ ] Testar funcionalidades loja

### Fase 4: Integração e Testes
- [ ] Integrar componentes no Admin Dashboard
- [ ] Integrar componentes no Loja Dashboard
- [ ] Testar fluxo completo
- [ ] Ajustar UI/UX
- [ ] Documentar

---

## 🎨 EXEMPLO VISUAL DETALHADO

### Admin View (Semana):

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📅 Semana de 28/12/2025 a 03/01/2026                     [+ Adicionar Tarefa]        │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Segunda      │ Terça        │ Quarta       │ Quinta       │ Sexta        │ Sábado       │
│ 28/12        │ 29/12        │ 30/12        │ 31/12        │ 01/01        │ 02/01        │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 🔴 ALTA      │ 🔴 ALTA      │ 🔴 ALTA      │ 🔴 ALTA      │ 🔴 ALTA      │ 🔴 ALTA      │
│ 10:00        │ 10:00        │ 10:00        │ 10:00        │ 10:00        │ 10:00        │
│ Varrer Loja  │ Varrer Loja  │ Varrer Loja  │ Varrer Loja  │ Varrer Loja  │ Varrer Loja  │
│ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │              │
│ 11:00        │ 11:00        │ 11:00        │ 11:00        │ 11:00        │              │
│ Espirrar     │ Espirrar     │ Espirrar     │ Espirrar     │ Espirrar     │              │
│ Essência     │ Essência     │ Essência     │ Essência     │ Essência     │              │
│ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### Loja View (Dia):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Segunda-feira, 28 de Dezembro de 2025 →                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  10:00  🔴 ALTA                                                             │
│  Varrer a Loja até 10H                                                     │
│  Status: ⚠️ PENDENTE - ATRASADO                                           │
│  [✅ Marcar como Concluída]                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  11:00  🟡 MÉDIA                                                            │
│  Espirrar Essência até 11H                                                 │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  12:00  🟡 MÉDIA                                                            │
│  Aspirar Provador até 12H                                                  │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        ──────── 13:00 ────────                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  14:00  🟢 BAIXA                                                            │
│  Ligar para Clientes até 14H                                               │
│  Status: ✅ CONCLUÍDA                                                       │
│  Concluída por: Maria Silva às 14:15                                       │
│  [↩️ Desmarcar]                                                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  15:00  🟢 BAIXA                                                            │
│  Levar Roupas na Costureira até 15H                                        │
│  Status: ⏳ PENDENTE                                                        │
│  [✅ Marcar como Concluída]                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 NOTAS TÉCNICAS

### Status Calculado:
- **CONCLUÍDA**: `completed_at IS NOT NULL`
- **ATRASADO**: `completed_at IS NULL AND due_time < CURRENT_TIME`
- **PENDENTE**: `completed_at IS NULL AND (due_time IS NULL OR due_time >= CURRENT_TIME)`

### Tarefas Recorrentes vs Não Recorrentes:
- **Recorrentes** (`is_recurring = true`): Aparecem todos os dias
- **Não Recorrentes** (`is_recurring = false`): Aparecem apenas no dia criado

### Ordenação:
1. Por horário (`due_time` ASC)
2. Por prioridade (ALTA > MÉDIA > BAIXA)
3. Por ordem de criação (`display_order`)

---

**Documento criado em:** 2025-12-28  
**Versão:** 1.0  
**Status:** Plano completo, pronto para implementação

