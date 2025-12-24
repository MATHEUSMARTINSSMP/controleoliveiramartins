# TODO - Melhorias Finais Lista da Vez

## ✅ CONCLUÍDO

### 1. ✅ Linkagem Automática Perfeita
- **Status:** ✅ Implementado
- **Arquivos:**
  - `supabase/migrations/20251223000008_improve_erp_linkage_and_queue_management.sql`
  - Função `auto_link_erp_sale_to_attendance` melhorada
- **Funcionalidade:**
  - Quando venda ERP é criada e colaboradora está em atendimento
  - Linka automaticamente
  - Finaliza o atendimento
  - Move colaboradora para final da fila automaticamente

### 2. ✅ Remover Dialog Nova Venda para ERP
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/pages/LojaDashboard.tsx`
- **Funcionalidade:**
  - Se venda do ERP já foi linkada automaticamente, não abre dialog de Nova Venda
  - Já tem todas as informações necessárias do ERP

### 3. ✅ Funções de Reorganizar Fila
- **Status:** ✅ Implementado
- **Arquivos:**
  - `supabase/migrations/20251223000008_improve_erp_linkage_and_queue_management.sql`
- **Funções:**
  - `move_member_to_top` - Move para o topo (posição 1)
  - `move_member_to_end` - Move para o final

### 4. ✅ Botões de Reorganizar na Lista
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/EsperandoAtendimento.tsx`
  - `src/components/loja/ListaDaVez.tsx`
- **Funcionalidade:**
  - Botão "↑" para mover para o topo (não aparece se já está no topo)
  - Botão "↓" para mover para o final
  - Aparecem ao lado do nome da colaboradora

### 5. ✅ Histórico de Atendimentos no Dash Loja
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/HistoricoAtendimentos.tsx`
  - `src/components/loja/ListaDaVez.tsx`
- **Funcionalidade:**
  - Componente de histórico dentro do modal Lista da Vez
  - Aba "Histórico" separada da aba "Fila de Atendimento"
  - Lista todos os atendimentos do dia
  - Filtro por data
  - Mostra: colaboradora, início, fim, duração, status, resultado
  - Botão "Novo" para criar atendimento manualmente
  - Botão "Editar" em cada linha

## ⏳ PENDENTE

### 6. ⏳ Editar Atendimento (Dialog)
- **Status:** ⏳ Pendente
- **O que precisa:**
  - Dialog/formulário para editar atendimento
  - Campos editáveis:
    - Colaboradora (select)
    - Data/hora de início
    - Data/hora de fim
    - Resultado (venda/perda)
    - Valor da venda (se venda)
    - Motivo da perda (se perda)
  - Função SQL para atualizar atendimento
- **Arquivos a criar:**
  - `src/components/loja/lista-da-vez/EditAttendanceDialog.tsx`
  - Função SQL `update_attendance` (se não existir)

### 7. ⏳ Criar Atendimento Manualmente (Dialog)
- **Status:** ⏳ Pendente
- **O que precisa:**
  - Dialog/formulário para criar atendimento manual
  - Campos:
    - Colaboradora (select)
    - Loja (automático)
    - Data/hora de início
    - Data/hora de fim (opcional)
    - Resultado (venda/perda)
    - Valor da venda (se venda)
    - Motivo da perda (se perda)
  - Função SQL para criar atendimento manual
- **Arquivos a criar:**
  - `src/components/loja/lista-da-vez/CreateAttendanceDialog.tsx`
  - Função SQL `create_attendance_manual`

### 8. ⏳ Alterar Colaboradora do Atendimento
- **Status:** ⏳ Pendente
- **O que precisa:**
  - Campo no dialog de edição para alterar colaboradora
  - Validar que colaboradora está ativa
  - Atualizar `profile_id` do atendimento
  - Opcionalmente atualizar `queue_members` se ainda estiver em andamento
- **Arquivos a modificar:**
  - `src/components/loja/lista-da-vez/EditAttendanceDialog.tsx`
  - Função SQL `transfer_attendance` (já existe, verificar se precisa melhorar)

### 9. ⏳ Histórico no Admin Dashboard
- **Status:** ⏳ Pendente
- **O que precisa:**
  - Adicionar nova aba/seção no Admin Dashboard
  - Integrar componente de histórico (pode reutilizar o mesmo)
  - Adicionar filtros adicionais (loja, período maior)
  - Adicionar exportação de dados

## 📋 Resumo do Fluxo Atual

### Linkagem Automática ERP
```
1. ERP envia venda → Trigger cria venda em sales
2. Trigger tenta linkar automaticamente
3. Se encontrar 1 atendimento ativo da colaboradora:
   ✅ Linka venda com atendimento
   ✅ Finaliza atendimento
   ✅ Cria attendance_outcome (venda)
   ✅ Move colaboradora para final da fila
4. Se múltiplos ou nenhum:
   ⚠️ Não linka (requer ação manual)
```

### Reorganizar Fila
```
1. Colaboradora clica "↑" → Move para topo (posição 1)
2. Colaboradora clica "↓" → Move para final
3. Fila é reorganizada automaticamente
```

### Histórico de Atendimentos
```
1. Usuário abre modal Lista da Vez
2. Clica na aba "Histórico"
3. Vê lista de atendimentos do dia
4. Pode filtrar por data
5. Pode criar novo atendimento
6. Pode editar atendimento existente
```

## 🎯 Próximos Passos

1. ✅ Criar componente de Histórico - **CONCLUÍDO**
2. ⏳ Criar dialog de Edição
3. ⏳ Criar dialog de Criação Manual
4. ⏳ Adicionar funcionalidade de transferir colaboradora
5. ⏳ Integrar histórico no Admin Dashboard (opcional)
