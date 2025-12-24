# TODO Detalhado - Melhorias Lista da Vez

## ✅ CONCLUÍDO

### 1. ✅ Remover Campo de Nome do Cliente Antes de Iniciar
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/EsperandoAtendimento.tsx` - Removido input de cliente
  - `src/hooks/use-lista-da-vez-attendances.ts` - Cliente nome agora opcional
  - `src/components/loja/ListaDaVez.tsx` - Removido estado clienteNome

### 2. ✅ Adicionar Botão STOP para Finalizar
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/EmAtendimento.tsx` - Adicionado botão STOP com ícone Square
  - Botão aparece apenas para quem está atendendo (isMe)
  - Estilo `variant="destructive"` para destacar

### 3. ✅ Quem Está em Atendimento Sai do Topo da Lista
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/hooks/use-lista-da-vez-queue.ts` - Query agora busca apenas `status = 'disponivel'`
  - Função SQL `reorganize_queue_positions` já remove automaticamente
  - Quem está `em_atendimento` não aparece mais na lista de esperando

### 4. ✅ Todas as Colaboradoras Têm Botão PLAY
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/EsperandoAtendimento.tsx` - Removida condição `isFirst`
  - Todas as colaboradoras na fila têm botão PLAY
  - Permite flexibilidade caso alguém precise passar na frente

### 5. ✅ Quem Finaliza Vai para o Final da Fila
- **Status:** ✅ Implementado (Backend)
- **Arquivos:**
  - `supabase/migrations/20251223000004_create_lista_da_vez_complete_robust.sql`
  - Função `end_attendance` já implementa isso (linhas 639-644)
  - Usa `get_next_queue_position` para colocar no final
  - `reorganize_queue_positions` reorganiza automaticamente

### 6. ✅ Formulário de Analytics Só Aparece ao Clicar em STOP
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/FinalizarAtendimentoDialog.tsx` - Novo componente
  - `src/components/loja/lista-da-vez/EmAtendimento.tsx` - Removido formulário inline
  - `src/components/loja/ListaDaVez.tsx` - Integrado dialog

### 7. ✅ Corrigido Cálculo de Duração (Não Mostra Negativo)
- **Status:** ✅ Implementado
- **Arquivos:**
  - `src/components/loja/lista-da-vez/EmAtendimento.tsx` - Função `calculateDuration`
  - Usa `Math.max(0, diffMinutes)` para garantir nunca negativo
  - Calcula em tempo real a partir de `started_at`

## 🔄 FLUXO COMPLETO ESPERADO

### 1. Habilitação
- Colaboradora ativa toggle em "Colaboradoras Disponíveis"
- Aparece em "Esperando Atendimento" no final da fila

### 2. Início de Atendimento
- Colaboradora clica PLAY (qualquer uma pode clicar)
- Move para "Em Atendimento"
- **Sai automaticamente** da lista "Esperando Atendimento"
- Próximo da fila vai para o topo automaticamente

### 3. Durante Atendimento
- Colaboradora aparece apenas em "Em Atendimento"
- Tempo é calculado em tempo real (não mostra negativo)
- Botão STOP disponível para finalizar

### 4. Finalização
- Colaboradora clica STOP
- Abre dialog "Finalizar Atendimento"
- Preenche:
  - Resultado: Venda ou Perda
  - Se venda: Valor da venda
  - Se perda: Motivo da perda
- Confirma

### 5. Retorno à Fila
- Colaboradora volta para "Esperando Atendimento"
- **No final da fila** (não no topo)
- Aguarda sua vez até todos na frente finalizarem

## 📊 DADOS PARA ANALYTICS

Quando finaliza atendimento, os dados são registrados em:
- `attendance_outcomes` - Resultado (venda/perda)
- `attendance_outcomes.sale_value` - Valor da venda (se venda)
- `attendance_outcomes.loss_reason_id` - Motivo da perda (se perda)
- `attendances.duration_seconds` - Duração calculada automaticamente

Esses dados alimentam:
- `get_store_metrics` - Métricas da loja
- `get_collaborator_metrics` - Métricas por colaboradora
- `get_period_trends` - Tendências
- `get_loss_reasons_analytics` - Análise de perdas
- `export_attendance_data` - Exportação para Excel

## ✅ CHECKLIST FINAL

- [x] Campo de cliente removido antes de iniciar
- [x] Botão STOP implementado
- [x] Quem está em atendimento não aparece em esperando
- [x] Todas têm botão PLAY
- [x] Quem finaliza vai para final da fila
- [x] Formulário só aparece ao clicar STOP
- [x] Duração não mostra negativo
- [x] Dialog separado para finalização
- [x] Reorganização automática da fila
- [x] Dados registrados para analytics

## 🎯 PRONTO PARA TESTE

Todas as melhorias foram implementadas. O sistema está pronto para teste em ambiente de desenvolvimento.

