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
- 🎯 Visualização tipo calendário: **Colunas = Dias da Semana (fixos)**, **Linhas = Tarefas**
- 🎯 **Tarefas fixas por dia da semana**: Toda Segunda-feira = mesmas tarefas, toda Terça-feira = mesmas tarefas, etc.
- 🎯 **Sem navegação entre semanas** - visualização fixa dos dias da semana
- 🎯 Status visual: **PENDENTE**, **PENDENTE - ATRASADO**, **CONCLUÍDA**
- 🎯 Admin: CRUD completo, prioridades, configurar tarefas por dia da semana
- 🎯 Loja: Visualizar tarefas do dia atual, concluir, indicar quem fez, marcar horário

---

## 🗄️ PARTE 1: MELHORIAS NO BANCO DE DADOS

### 1.1 Adicionar Campos `priority` e `weekday` à Tabela `daily_tasks`

**Migration:** `20251228000001_add_priority_and_weekday_to_daily_tasks.sql`

```sql
-- Adicionar coluna priority
ALTER TABLE sistemaretiradas.daily_tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MÉDIA' 
CHECK (priority IN ('ALTA', 'MÉDIA', 'BAIXA'));

COMMENT ON COLUMN sistemaretiradas.daily_tasks.priority IS 'Prioridade da tarefa: ALTA, MÉDIA ou BAIXA';

-- Adicionar coluna weekday (dia da semana)
ALTER TABLE sistemaretiradas.daily_tasks
ADD COLUMN IF NOT EXISTS weekday INTEGER 
CHECK (weekday BETWEEN 0 AND 6); -- 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

COMMENT ON COLUMN sistemaretiradas.daily_tasks.weekday IS 'Dia da semana fixo (0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado). NULL = tarefa aparece todos os dias';

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_daily_tasks_priority 
ON sistemaretiradas.daily_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_weekday 
ON sistemaretiradas.daily_tasks(weekday);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_store_weekday 
ON sistemaretiradas.daily_tasks(store_id, weekday, is_active);
```

**Justificativa:** 
- `priority`: Permitir que admin marque prioridades nas tarefas (ALTA, MÉDIA, BAIXA)
- `weekday`: Vincular tarefa a um dia da semana específico. Se `NULL`, tarefa aparece todos os dias

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
- ✅ Visualização em formato tabela: **Colunas = Dias da Semana (fixos)** (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
- ✅ Linhas dinâmicas: Tarefas adicionadas conforme demanda
- ✅ Ordenação por horário (`due_time`) dentro de cada dia
- ✅ Indicador visual de prioridade (cores: ALTA=vermelho, MÉDIA=amarelo, BAIXA=verde)
- ✅ **Sem navegação entre semanas** - visualização fixa dos dias da semana
- ✅ Filtro por loja
- ✅ Botão "Adicionar Tarefa" abre modal de criação (seleciona dia da semana)

**Interface:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📅 Tarefas Semanais (Configuração Fixa)                    [+ Adicionar]  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ Segunda  │ Terça    │ Quarta   │ Quinta   │ Sexta    │ Sábado   │ Domingo  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 10:00    │ 10:00    │          │          │ 10:00    │          │          │
│ 🔴 ALTA  │ 🔴 ALTA  │          │          │ 🔴 ALTA  │          │          │
│ Varrer   │ Varrer   │          │          │ Varrer   │          │          │
│ Loja     │ Loja     │          │          │ Loja     │          │          │
│ [✏️][🗑️] │ [✏️][🗑️] │          │          │ [✏️][🗑️] │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 11:00    │ 11:00    │ 11:00    │ 11:00    │ 11:00    │          │          │
│ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │ 🟡 MÉDIA │          │          │
│ Espirrar │ Espirrar │ Espirrar │ Espirrar │ Espirrar │          │          │
│ Essência │ Essência │ Essência │ Essência │ Essência │          │          │
│ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │ 12:00    │          │          │          │          │
│          │          │ 🟡 MÉDIA │          │          │          │          │
│          │          │ Aspirar  │          │          │          │          │
│          │          │ Provador │          │          │          │          │
│          │          │ [✏️][🗑️] │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 14:00    │ 14:00    │ 14:00    │ 14:00    │ 14:00    │          │          │
│ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │ 🟢 BAIXA │          │          │
│ Ligar    │ Ligar    │ Ligar    │ Ligar    │ Ligar    │          │          │
│ Clientes │ Clientes │ Clientes │ Clientes │ Clientes │          │          │
│ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │ [✏️][🗑️] │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Nota:** Cada tarefa está vinculada a um dia da semana específico. Não há navegação entre semanas - a visualização mostra a configuração fixa para cada dia da semana.

**Estrutura de Dados:**
```typescript
interface TaskCalendarCell {
  weekday: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  weekdayName: string; // "Segunda", "Terça", etc
  tasks: DailyTask[];
}

interface DailyTask {
  id: string;
  title: string;
  due_time: string; // "10:00", "14:00", etc
  priority: "ALTA" | "MÉDIA" | "BAIXA";
  weekday: number | null; // 0-6 ou null (se aparece todos os dias)
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
- ✅ **Dia da Semana** - Select único ou Radio (obrigatório)
  - [ ] Todos os dias (weekday = NULL)
  - [ ] Segunda-feira (weekday = 1)
  - [ ] Terça-feira (weekday = 2)
  - [ ] Quarta-feira (weekday = 3)
  - [ ] Quinta-feira (weekday = 4)
  - [ ] Sexta-feira (weekday = 5)
  - [ ] Sábado (weekday = 6)
  - [ ] Domingo (weekday = 0)

**Lógica:**
- **Uma tarefa = Um dia da semana** (ou todos os dias se weekday = NULL)
- Se admin quer a mesma tarefa em múltiplos dias, cria tarefas separadas
- Exemplo: "Varrer Loja às 10h" na Segunda, Terça e Sexta = 3 tarefas separadas

### 2.3 Funcionalidades Admin:

1. **Adicionar Tarefa:**
   - Clica em "+" ou botão "Adicionar Tarefa"
   - Abre modal de criação
   - Define horário, prioridade, **dia da semana** (obrigatório)
   - Salva tarefa vinculada àquele dia específico
   - Se quer mesma tarefa em múltiplos dias, cria tarefas separadas

2. **Editar Tarefa:**
   - Clica em ✏️ na célula
   - Abre modal de edição
   - Edita todos os campos (incluindo dia da semana)
   - Salva alterações

3. **Deletar Tarefa:**
   - Clica em 🗑️ na célula
   - Confirmação: "Deseja realmente excluir esta tarefa?"
   - Deleta apenas aquela tarefa específica (daquele dia da semana)

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
- ✅ Visualização focada no **dia atual** (semana atual)
- ✅ Mostra apenas tarefas do dia da semana atual (ex: se hoje é Segunda, mostra tarefas de Segunda)
- ✅ Status visual: PENDENTE, PENDENTE - ATRASADO, CONCLUÍDA (calculado baseado no dia atual)
- ✅ Indicador de quem completou (se concluída no dia atual)
- ✅ Botão "Marcar como Concluída"
- ✅ Mostra horário de conclusão
- ✅ Tarefas são ordenadas por horário (`due_time`)

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

5. **Visualização:**
   - Mostra sempre as tarefas do dia atual (calcula automaticamente qual dia da semana é hoje)
   - Se hoje é Segunda-feira, mostra tarefas configuradas para Segunda-feira
   - Se hoje é Terça-feira, mostra tarefas configuradas para Terça-feira
   - Data atual exibida no topo: "Segunda-feira, 28 de Dezembro de 2025"

---

## 🔧 PARTE 4: FUNÇÕES RPC (Backend)

### 4.1 Função: `get_daily_tasks_by_weekday` (Para Admin - ver toda a semana)

```sql
CREATE OR REPLACE FUNCTION sistemaretiradas.get_daily_tasks_by_weekday(
    p_store_id UUID
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    title VARCHAR,
    description TEXT,
    due_time TIME,
    priority VARCHAR,
    weekday INTEGER, -- 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    shift_id UUID,
    shift_name VARCHAR,
    display_order INTEGER
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
        dt.weekday,
        dt.shift_id,
        s.name as shift_name,
        dt.display_order
    FROM sistemaretiradas.daily_tasks dt
    LEFT JOIN sistemaretiradas.shifts s ON s.id = dt.shift_id
    WHERE dt.store_id = p_store_id
      AND dt.is_active = true
    ORDER BY 
        COALESCE(dt.weekday, 999), -- NULL (todos os dias) no final
        dt.due_time NULLS LAST,
        dt.priority DESC,
        dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Uso:** Admin usa esta função para ver todas as tarefas organizadas por dia da semana (visualização calendário)

### 4.2 Função: `get_daily_tasks_by_weekday_current` (Para Loja - ver dia atual)

```sql
-- Atualizar função existente para usar weekday ao invés de is_recurring
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
    weekday INTEGER, -- ✅ NOVO
    is_active BOOLEAN,
    display_order INTEGER,
    created_at TIMESTAMPTZ,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    status VARCHAR -- ✅ NOVO: 'PENDENTE', 'ATRASADO', 'CONCLUÍDA'
) AS $$
DECLARE
    v_weekday INTEGER;
BEGIN
    -- Calcular dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
    -- PostgreSQL: EXTRACT(DOW FROM date) retorna 0 (Domingo) a 6 (Sábado)
    v_weekday := EXTRACT(DOW FROM p_date)::INTEGER;

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
        dt.weekday, -- ✅ NOVO
        dt.is_active,
        dt.display_order,
        dt.created_at,
        tc.profile_id as completed_by,
        tc.completed_at,
        tc.notes as completion_notes,
        CASE -- ✅ NOVO: Calcula status baseado no dia atual
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
        dt.weekday IS NULL -- Tarefas que aparecem todos os dias
        OR dt.weekday = v_weekday -- Tarefas do dia da semana específico
      )
    ORDER BY 
        dt.due_time NULLS LAST,
        dt.priority DESC, -- ✅ NOVO: Ordena por prioridade (ALTA > MÉDIA > BAIXA)
        dt.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Nota:** Esta função calcula automaticamente o dia da semana da data fornecida e retorna apenas as tarefas configuradas para aquele dia (ou tarefas com `weekday = NULL` que aparecem todos os dias).

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
- [ ] Migration: Adicionar `priority` e `weekday` à `daily_tasks`
- [ ] Migration: Atualizar função `get_daily_tasks` com status e weekday
- [ ] Migration: Criar função `get_daily_tasks_by_weekday` (para admin)
- [ ] Migration: Criar tabela `task_notifications` para notificações em tempo real
- [ ] Migration: Criar função/cron para detectar tarefas atrasadas
- [ ] Migration: Criar trigger para detectar quando tarefa entra em atraso
- [ ] Testar migrations

### Fase 2: Backend - Notificações e Tempo Real
- [ ] Criar função Netlify `task-check-overdue` (cron job para verificar tarefas atrasadas)
- [ ] Integrar com sistema de WhatsApp (número global) para enviar notificações
- [ ] Criar função para enviar notificação WhatsApp quando tarefa atrasa
- [ ] Configurar Supabase Realtime para `task_completions` (mudanças em tempo real)
- [ ] Configurar Supabase Realtime para `daily_tasks` (atualizações em tempo real)
- [ ] Testar notificações WhatsApp
- [ ] Testar tempo real

### Fase 3: Componentes Admin
- [ ] Criar `AdminTasksCalendarView.tsx`
- [ ] Criar `TaskEditDialog.tsx`
- [ ] Integrar com hook `useDailyTasks`
- [ ] Implementar CRUD (Create, Read, Update, Delete)
- [ ] Implementar visualização de prioridades
- [ ] Integrar com Supabase Realtime para atualizações em tempo real
- [ ] Testar funcionalidades admin

### Fase 4: Componentes Loja
- [ ] Criar `LojaTasksCalendarView.tsx`
- [ ] Criar `TaskCompletionDialog.tsx`
- [ ] Criar `TaskStatusBadge.tsx`
- [ ] Criar componente `TaskOverdueNotification.tsx` (notificação de tarefa atrasada)
- [ ] Implementar visualização focada no dia atual
- [ ] Implementar marcação de conclusão
- [ ] Implementar visualização de status (PENDENTE, ATRASADO, CONCLUÍDA)
- [ ] Integrar com Supabase Realtime para:
  - Atualizações de status em tempo real (sem F5)
  - Notificações de tarefas atrasadas em tempo real
  - Mudanças de `task_completions` em tempo real
- [ ] Implementar toast/notification quando tarefa entra em atraso
- [ ] Testar funcionalidades loja

### Fase 5: Integração e Testes
- [ ] Integrar componentes no Admin Dashboard
- [ ] Integrar componentes no Loja Dashboard
- [ ] Testar fluxo completo
- [ ] Testar notificações em tempo real
- [ ] Testar envio de WhatsApp
- [ ] Testar atualização de status em tempo real
- [ ] Ajustar UI/UX
- [ ] Documentar

---

## 🎨 EXEMPLO VISUAL DETALHADO

### Admin View (Semana Fixa):

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  📅 Configuração de Tarefas Semanais (Fixas)              [+ Adicionar Tarefa]        │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Segunda      │ Terça        │ Quarta       │ Quinta       │ Sexta        │ Sábado       │
│              │              │              │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 🔴 ALTA      │ 🔴 ALTA      │              │              │ 🔴 ALTA      │              │
│ 10:00        │ 10:00        │              │              │ 10:00        │              │
│ Varrer Loja  │ Varrer Loja  │              │              │ Varrer Loja  │              │
│ [✏️] [🗑️]   │ [✏️] [🗑️]   │              │              │ [✏️] [🗑️]   │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │ 🟡 MÉDIA     │              │
│ 11:00        │ 11:00        │ 11:00        │ 11:00        │ 11:00        │              │
│ Espirrar     │ Espirrar     │ Espirrar     │ Espirrar     │ Espirrar     │              │
│ Essência     │ Essência     │ Essência     │ Essência     │ Essência     │              │
│ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│              │              │ 🟡 MÉDIA     │              │              │              │
│              │              │ 12:00        │              │              │              │
│              │              │ Aspirar      │              │              │              │
│              │              │ Provador     │              │              │              │
│              │              │ [✏️] [🗑️]   │              │              │              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 🟢 BAIXA     │ 🟢 BAIXA     │ 🟢 BAIXA     │ 🟢 BAIXA     │ 🟢 BAIXA     │              │
│ 14:00        │ 14:00        │ 14:00        │ 14:00        │ 14:00        │              │
│ Ligar        │ Ligar        │ Ligar        │ Ligar        │ Ligar        │              │
│ Clientes     │ Clientes     │ Clientes     │ Clientes     │ Clientes     │              │
│ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │ [✏️] [🗑️]   │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Nota:** Não há navegação entre semanas. A visualização mostra a configuração fixa para cada dia da semana.

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

### Tarefas por Dia da Semana:
- **Tarefas com `weekday = NULL`**: Aparecem todos os dias
- **Tarefas com `weekday = 0`**: Aparecem apenas aos Domingos
- **Tarefas com `weekday = 1`**: Aparecem apenas às Segundas-feiras
- **Tarefas com `weekday = 2`**: Aparecem apenas às Terças-feiras
- E assim por diante...

### Nota sobre `is_recurring`:
- Campo `is_recurring` pode ser removido no futuro (substituído por `weekday`)
- Por enquanto, manteremos para compatibilidade, mas a lógica principal usa `weekday`

### Ordenação:
1. Por horário (`due_time` ASC)
2. Por prioridade (ALTA > MÉDIA > BAIXA)
3. Por ordem de criação (`display_order`)

---

---

## 📚 NOTAS TÉCNICAS ADICIONAIS

### Notificações em Tempo Real:
- Ver documento: `docs/TAREFAS_NOTIFICACOES_TEMPO_REAL.md`
- Notificações aparecem sem precisar atualizar (F5)
- Mudanças de status também em tempo real
- WhatsApp enviado via número global quando tarefa atrasa

### Status Calculado:
- **CONCLUÍDA**: `completed_at IS NOT NULL`
- **ATRASADO**: `completed_at IS NULL AND due_time < CURRENT_TIME`
- **PENDENTE**: `completed_at IS NULL AND (due_time IS NULL OR due_time >= CURRENT_TIME)`

---

**Documento criado em:** 2025-12-28  
**Versão:** 1.1  
**Status:** Plano completo, pronto para implementação  
**Documentos relacionados:** `docs/TAREFAS_NOTIFICACOES_TEMPO_REAL.md`

