# 📊 Análise: Componentes Google My Business com Dados Mock

## ✅ Componentes com Dados REAIS

1. **MediaManager.tsx** ✅ - Busca mídias reais via API
2. **GooglePostsManager.tsx** ✅ - Busca posts reais via API (através do hook)
3. **GoogleLocations.tsx** ✅ - Busca locations reais do banco
4. **ReviewsList.tsx** ✅ - Exibe reviews reais do banco
5. **ConnectionStatus.tsx** ✅ - Status real da conexão
6. **GoogleSettings.tsx** ✅ - Configurações reais
7. **GoogleNotifications.tsx** ✅ - Notificações baseadas em reviews reais

---

## ❌ Componentes com Dados MOCK (Precisam ser corrigidos)

### 1. **GoogleStats.tsx** (CRÍTICO)
**Localização:** `src/components/google-integration/GoogleStats.tsx`

**Dados Mock:**
- **Linhas 33-38:** `insightsData` - Views, clicks, calls, directions com valores hardcoded (1250, 450, 85, 120)
- **Linhas 48-57:** `topKeywords` - Palavras-chave hardcoded ("atendimento", "qualidade", etc)
- **Linhas 87-88:** Location filter com valores mock ("loc1", "loc2")

**Ação necessária:**
- Criar função Netlify para buscar insights/performance do Google My Business API
- Criar função para buscar palavras-chave reais
- Conectar location filter às locations reais

---

### 2. **QuestionsManager.tsx** (CRÍTICO)
**Localização:** `src/components/google-integration/questions/QuestionsManager.tsx`

**Dados Mock:**
- **Linhas 30-62:** Array `questions` inicial com perguntas simuladas (Maria Silva, João Souza, Ana Costa)

**Ação necessária:**
- Criar função Netlify `google-questions-fetch.js`
- Criar hook `use-google-questions.ts`
- Conectar componente à API real

---

### 3. **ProfileHealth.tsx**
**Localização:** `src/components/google-integration/ProfileHealth.tsx`

**Dados Mock:**
- **Linhas 93-100:** `historyData` - Histórico de saúde com dados simulados (Jan-Jun)
- **Linha 103:** `handleExportPDF` mostra toast "Simulação"

**Ação necessária:**
- Buscar histórico real do banco ou calcular baseado em timestamps das locations
- Implementar exportação real de PDF

**Nota:** A análise de saúde em si (linhas 36-90) está baseada em dados reais da location.

---

### 4. **StatsInsights.tsx** (Recebe dados mock)
**Localização:** `src/components/google-integration/stats/StatsInsights.tsx`

**Dados Mock:**
- Recebe `insightsData` como prop, que vem mockado de `GoogleStats.tsx`

**Ação necessária:**
- Corrigir `GoogleStats.tsx` para passar dados reais

---

### 5. **AdvancedInsights.tsx**
**Localização:** `src/components/google-integration/stats/AdvancedInsights.tsx`

**Dados Mock:**
- **Linhas 7-12:** `interactionData` - Interações comparativas (Chamadas, Rotas, Website, Mensagens)
- **Linhas 15-20:** `deviceData` - Origem do tráfego (Mobile, Desktop, Maps)

**Ação necessária:**
- Buscar dados de insights do Google My Business Performance Reports API
- Conectar aos dados reais de performance

---

### 6. **ReviewsAnalytics.tsx**
**Localização:** `src/components/google-integration/stats/ReviewsAnalytics.tsx`

**Dados Mock:**
- **Linhas 6-13:** `volumeData` - Volume de reviews mensal (Jan-Jun)
- **Linhas 16-23:** `responseRateData` - Taxa de resposta mensal

**Ação necessária:**
- Calcular dados reais baseados em reviews do banco
- Agrupar por mês e calcular métricas

---

### 7. **PostsAnalytics.tsx**
**Localização:** `src/components/google-integration/stats/PostsAnalytics.tsx`

**Dados Mock:**
- **Linhas 6-13:** `postsVolumeData` - Volume de postagens mensal
- **Linhas 16-21:** `engagementData` - Engajamento por tipo
- **Linhas 24-29:** `ctaData` - Performance de CTA

**Ação necessária:**
- Usar posts reais já buscados
- Calcular métricas baseadas em posts reais

---

### 8. **CategoryAnalytics.tsx**
**Localização:** `src/components/google-integration/stats/CategoryAnalytics.tsx`

**Dados Mock:**
- **Linhas 6-10:** `categoryData` - Categorias do perfil
- **Linhas 13-18:** `competitorData` - Comparativo com concorrentes

**Ação necessária:**
- Buscar categorias reais da location
- Comparativo com concorrentes pode não estar disponível na API (remover ou marcar como "em desenvolvimento")

---

### 9. **KeywordManager.tsx**
**Localização:** `src/components/google-integration/stats/KeywordManager.tsx`

**Dados Mock:**
- **Linhas 8-16:** Array `keywords` com termos hardcoded

**Ação necessária:**
- Buscar palavras-chave reais do Google My Business Performance Reports API
- Ou calcular baseado em reviews (extrair palavras-chave dos comentários)

---

### 10. **PerformanceReport.tsx**
**Localização:** `src/components/google-integration/reports/PerformanceReport.tsx`

**Dados Mock:**
- **Linha 8:** `handleExportPDF` mostra toast "Simulação"
- **Linha 12:** `handleSendEmail` mostra toast "Simulação"

**Ação necessária:**
- Implementar exportação real de PDF
- Implementar envio real por e-mail

---

### 11. **CategorySearch.tsx**
**Localização:** `src/components/google-integration/categories/CategorySearch.tsx`

**Dados Mock:**
- **Linhas 26-31:** `mockResults` - Resultados simulados de busca de categorias

**Ação necessária:**
- Integrar com API do Google para busca de categorias
- Ou usar dados reais de categorias disponíveis

---

## 📋 Resumo

### Total de Componentes: 11 componentes com dados mock

### Prioridade ALTA (Funcionalidades principais):
1. GoogleStats.tsx
2. QuestionsManager.tsx
3. AdvancedInsights.tsx
4. ReviewsAnalytics.tsx

### Prioridade MÉDIA (Analytics complementares):
5. PostsAnalytics.tsx
6. CategoryAnalytics.tsx
7. KeywordManager.tsx

### Prioridade BAIXA (Funcionalidades auxiliares):
8. ProfileHealth.tsx (histórico)
9. PerformanceReport.tsx (exportação)
10. CategorySearch.tsx (busca de categorias)
11. StatsInsights.tsx (recebe dados mock, precisa corrigir fonte)

---

## 🎯 Plano de Ação Recomendado

### Fase 1: Dados Críticos
1. Corrigir `GoogleStats.tsx` (insights e keywords)
2. Implementar `QuestionsManager.tsx` com dados reais
3. Corrigir `AdvancedInsights.tsx` com dados de performance

### Fase 2: Analytics
4. Corrigir `ReviewsAnalytics.tsx` usando reviews reais
5. Corrigir `PostsAnalytics.tsx` usando posts reais

### Fase 3: Funcionalidades Auxiliares
6. Corrigir histórico em `ProfileHealth.tsx`
7. Implementar exportação real em `PerformanceReport.tsx`
8. Corrigir outros componentes conforme disponibilidade de API

