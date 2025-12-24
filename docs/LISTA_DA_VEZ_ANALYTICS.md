# Lista da Vez - Analytics Robusta

## ✅ Implementação Completa

### 📊 Funções SQL de Analytics

#### 1. **get_collaborator_detailed_metrics**
Métricas detalhadas por colaboradora:
- Total de atendimentos, vendas, perdas
- Taxa de conversão
- Valores médios e totais
- Duração de atendimentos (média, mín, máx)
- Tempo na fila
- Melhor e pior dia

#### 2. **get_store_detailed_metrics**
Métricas detalhadas da loja:
- Total de atendimentos, vendas, perdas
- Taxa de conversão
- Faturamento total e médio
- Tempo médio de atendimento
- Colaboradoras ativas
- Horário de pico
- Melhor e pior dia
- Top colaboradora

#### 3. **get_period_trends**
Tendências por período:
- Agrupamento por dia, semana ou mês
- Atendimentos, vendas, conversão por período
- Visualização de tendências ao longo do tempo

#### 4. **get_loss_reasons_analytics**
Análise de motivos de perda:
- Quantidade de perdas por motivo
- Percentual de cada motivo
- Duração média de atendimentos perdidos
- Valor médio perdido

#### 5. **get_hourly_analytics**
Analytics por horário do dia:
- Atendimentos por hora (0-23h)
- Vendas por hora
- Taxa de conversão por hora
- Duração média por hora
- Valor médio por hora

#### 6. **get_collaborators_ranking**
Ranking de colaboradoras:
- Ordenado por vendas e conversão
- Top N colaboradoras
- Métricas comparativas

#### 7. **compare_periods**
Comparação entre períodos:
- Comparação lado a lado
- Diferença absoluta e percentual
- Variação de métricas

#### 8. **export_attendance_data**
Exportação de dados:
- Dados brutos de atendimentos
- Formato para Excel/CSV
- Todos os campos relevantes

### 🎣 Hooks React

**`useListaDaVezAnalytics`**
- `getCollaboratorDetailedMetrics` - Métricas detalhadas de colaboradora
- `getStoreDetailedMetrics` - Métricas detalhadas da loja
- `getPeriodTrends` - Tendências por período
- `getLossReasonsAnalytics` - Analytics de motivos de perda
- `getHourlyAnalytics` - Analytics por horário
- `getCollaboratorsRanking` - Ranking de colaboradoras
- `comparePeriods` - Comparação de períodos
- `exportAttendanceData` - Exportação de dados

### 📈 Componente de Analytics

**`ListaDaVezAnalytics`** - Dashboard completo com:

#### Abas:
1. **Visão Geral**
   - Cards com métricas principais
   - Top colaboradora
   - Resumo executivo

2. **Tendências**
   - Gráfico de linha com evolução temporal
   - Atendimentos, vendas e conversão
   - Agrupamento por dia/semana/mês

3. **Por Horário**
   - Gráfico de barras por hora do dia
   - Identificação de horários de pico
   - Análise de performance por horário

4. **Motivos de Perda**
   - Gráfico de pizza
   - Tabela detalhada
   - Percentuais e quantidades

5. **Ranking**
   - Tabela de colaboradoras
   - Ordenado por performance
   - Métricas comparativas

6. **Comparação**
   - Comparação com período anterior
   - Indicadores de crescimento/queda
   - Variação percentual

#### Funcionalidades:
- ✅ Filtros por loja
- ✅ Filtros por período (hoje, semana, mês, personalizado)
- ✅ Agrupamento configurável (dia/semana/mês)
- ✅ Exportação para Excel
- ✅ Gráficos interativos (Recharts)
- ✅ Tabelas detalhadas
- ✅ Indicadores visuais (badges, progress bars)
- ✅ Responsivo

### 📊 Métricas Disponíveis

#### Por Colaboradora:
- Total de atendimentos
- Total de vendas
- Total de perdas
- Taxa de conversão
- Faturamento total e médio
- Duração média/mín/máx de atendimentos
- Tempo médio na fila
- Melhor e pior dia

#### Por Loja:
- Total de atendimentos
- Total de vendas
- Taxa de conversão
- Faturamento total
- Tempo médio de atendimento
- Colaboradoras ativas
- Horário de pico
- Melhor e pior dia
- Top colaboradora

#### Por Período:
- Evolução temporal
- Tendências de crescimento
- Sazonalidade
- Comparação entre períodos

#### Por Horário:
- Performance por hora do dia
- Identificação de picos
- Otimização de recursos

#### Por Motivo de Perda:
- Análise de causas
- Percentuais
- Impacto no faturamento

### 🚀 Como Usar

1. **Acessar Analytics:**
   - Admin Dashboard → Gestão de Metas → ListaDaVezAnalytics

2. **Selecionar Loja:**
   - Escolher loja específica ou todas

3. **Selecionar Período:**
   - Hoje, última semana, este mês, mês anterior ou personalizado

4. **Visualizar Dados:**
   - Navegar pelas abas
   - Analisar gráficos e tabelas

5. **Exportar:**
   - Clicar em "Exportar Dados (Excel)"
   - Dados brutos para análise externa

### 📝 Dados Exportados

O Excel contém:
- ID do atendimento
- Data e hora
- ID e nome da colaboradora
- Nome do cliente
- Duração (minutos)
- Resultado (venda/perda)
- Valor da venda
- Motivo da perda
- ID da sessão

### 🔄 Atualização em Tempo Real

- Todas as métricas são calculadas em tempo real
- Dados sempre atualizados do banco
- Sem cache (dados sempre frescos)

### ⚡ Performance

- Queries otimizadas com índices
- Agregações no banco de dados
- Paginação e limites quando necessário
- Cálculos eficientes

### 🎯 Casos de Uso

1. **Análise de Performance:**
   - Identificar top performers
   - Encontrar oportunidades de melhoria
   - Comparar períodos

2. **Otimização de Recursos:**
   - Identificar horários de pico
   - Distribuir colaboradoras
   - Planejar escalas

3. **Análise de Perdas:**
   - Identificar principais motivos
   - Criar estratégias de redução
   - Treinar colaboradoras

4. **Tendências:**
   - Acompanhar evolução
   - Prever demandas
   - Planejar ações

5. **Comparação:**
   - Avaliar impacto de mudanças
   - Medir crescimento
   - Benchmarking

