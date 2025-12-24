# Lista da Vez - Documentação de Implementação

## ✅ Estrutura Modular Implementada

### Hooks Customizados (Realtime)
1. **`use-lista-da-vez-session.ts`** - Gerencia sessão da fila
2. **`use-lista-da-vez-queue.ts`** - Gerencia fila e membros (com realtime)
3. **`use-lista-da-vez-attendances.ts`** - Gerencia atendimentos (com realtime)
4. **`use-lista-da-vez-colaboradoras.ts`** - Gerencia colaboradoras disponíveis (com realtime)
5. **`use-lista-da-vez-metrics.ts`** - Gerencia métricas (com realtime)

### Componentes Modulares
1. **`ColaboradorasDisponiveis.tsx`** - Lista de colaboradoras com toggle
2. **`EsperandoAtendimento.tsx`** - Coluna de quem está aguardando
3. **`EmAtendimento.tsx`** - Coluna de quem está atendendo
4. **`ListaDaVezMetrics.tsx`** - Cards de métricas
5. **`ListaDaVez.tsx`** - Componente principal (orquestrador)

## ✅ Funcionalidades Implementadas

### 1. Módulo Ativável/Desativável
- ✅ Campo `lista_da_vez_ativo` na tabela `stores`
- ✅ Configuração no Admin Dashboard (ModulesStoreConfig)
- ✅ Botão flutuante aparece apenas quando módulo está ativo

### 2. Botão Flutuante
- ✅ Botão circular fixo no canto inferior direito
- ✅ Aparece rapidamente quando módulo está ativo
- ✅ Abre dialog sem recarregar página

### 3. Colaboradoras Disponíveis
- ✅ Mostra todas colaboradoras ativas da loja
- ✅ Inicialmente todas desabilitadas
- ✅ Toggle para habilitar/desabilitar
- ✅ Atualização em tempo real quando alguém habilita/desabilita

### 4. Esperando Atendimento
- ✅ Colaboradoras habilitadas aparecem aqui
- ✅ Ordenadas por posição (1º, 2º, 3º...)
- ✅ Próximo da vez (1º) pode iniciar atendimento
- ✅ Campo para nome do cliente
- ✅ Botão "Play" para iniciar
- ✅ Atualização automática quando posições mudam

### 5. Em Atendimento
- ✅ Colaboradoras que iniciaram atendimento aparecem aqui
- ✅ Mostra nome do cliente e duração
- ✅ Botão "Finalizar" para quem está atendendo
- ✅ Formulário de resultado (venda/perda)
- ✅ Campo de valor para vendas
- ✅ Seleção de motivo para perdas
- ✅ Atualização automática quando atendimentos mudam

### 6. Reorganização Automática
- ✅ Quando alguém inicia atendimento, próximo vai para o topo
- ✅ Quando alguém finaliza, volta para o final da fila
- ✅ Reorganização acontece automaticamente via triggers SQL

### 7. Métricas em Tempo Real
- ✅ Total de atendimentos do dia
- ✅ Taxa de conversão da loja
- ✅ Total de vendas
- ✅ Tempo médio de atendimento
- ✅ Atualização automática quando atendimentos são finalizados

### 8. Realtime (Sem Refresh)
- ✅ Todas as mudanças são detectadas automaticamente
- ✅ Subscriptions em:
  - `queue_members` (mudanças na fila)
  - `attendances` (mudanças em atendimentos)
  - `attendance_outcomes` (resultados de atendimentos)
  - `profiles` (mudanças em colaboradoras)
- ✅ Atualização instantânea sem F5

### 9. Minimizar/Maximizar
- ✅ Botão para minimizar dialog
- ✅ Permite trabalhar enquanto dialog está minimizado
- ✅ Atualizações continuam funcionando mesmo minimizado

## 🔄 Fluxo Completo

1. **Colaboradora chega** → Toggle ON em "Colaboradoras Disponíveis"
2. **Entra na fila** → Aparece em "Esperando Atendimento" no final
3. **Vira 1º da fila** → Pode iniciar atendimento (botão Play)
4. **Inicia atendimento** → Move para "Em Atendimento"
5. **Próximo vai para o topo** → Automaticamente reorganizado
6. **Finaliza atendimento** → Preenche resultado (venda/perda)
7. **Volta para fila** → Retorna para "Esperando Atendimento" no final
8. **Métricas atualizadas** → Automaticamente via realtime

## 📊 Métricas Registradas

- Total de atendimentos por dia
- Duração de cada atendimento
- Taxa de conversão individual (por colaboradora)
- Taxa de conversão da loja
- Valor total de vendas
- Motivos de perda de venda

## 🗄️ Estrutura do Banco

- `queue_sessions` - Sessões de fila por dia/turno
- `queue_members` - Membros na fila
- `attendances` - Atendimentos em andamento/finalizados
- `attendance_outcomes` - Resultados (venda/perda)
- `loss_reasons` - Motivos de perda
- `queue_events` - Auditoria/log
- `queue_store_settings` - Configurações por loja

## ⚡ Performance

- Todas as queries são otimizadas com índices
- Realtime usa subscriptions eficientes
- Componentes modulares evitam re-renders desnecessários
- Hooks com useCallback para evitar loops infinitos

