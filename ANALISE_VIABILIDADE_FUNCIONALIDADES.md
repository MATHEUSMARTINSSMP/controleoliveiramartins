# Análise de Viabilidade Técnica - Funcionalidades Selecionadas

## 📋 Funcionalidades a Analisar
1. Sistema de Cashback
2. Sistema de Comissões Automáticas
4. Relatórios Avançados e Analytics
7. Sistema de Folha de Ponto
8. Sistema de Metas Inteligentes (IA)
11. Gamificação com Badges e Conquistas

---

## 1. 💰 Sistema de Cashback

### Viabilidade Técnica: ⭐⭐⭐⭐⭐ (Muito Alta)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Integração Simples:** Usa tabela `sales` existente
- **Cálculo Direto:** Pode calcular cashback baseado em `valor` da venda
- **Estrutura Simples:** Apenas 2-3 novas tabelas necessárias
- **Sem Dependências Externas:** Não precisa de APIs externas

#### 📊 Estrutura de Dados Necessária

```sql
-- Tabela principal de cashback
CREATE TABLE cashback_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    balance DECIMAL(10,2) DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0,
    total_redeemed DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(colaboradora_id)
);

-- Histórico de transações
CREATE TABLE cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    sale_id UUID REFERENCES sales(id), -- Venda que gerou cashback
    transaction_type TEXT NOT NULL, -- 'EARNED' | 'REDEEMED' | 'EXPIRED'
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Regras de cashback (configuráveis)
CREATE TABLE cashback_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    percentage DECIMAL(5,2) NOT NULL, -- Ex: 2.5 = 2.5%
    min_purchase_value DECIMAL(10,2), -- Valor mínimo da compra
    max_cashback_per_transaction DECIMAL(10,2), -- Limite por transação
    valid_from DATE,
    valid_until DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 🔧 Implementação Técnica

**Backend:**
- Trigger no Supabase para calcular cashback automaticamente ao inserir venda
- Função RPC para resgatar cashback
- Função RPC para consultar saldo

**Frontend:**
- Componente `CashbackBalance` no dashboard da colaboradora
- Página de histórico de transações
- Modal de resgate de cashback
- Integração com sistema de compras (usar cashback como desconto)

#### ⏱️ Tempo Estimado: 2-3 semanas
- Backend (tabelas + triggers + RPCs): 3-4 dias
- Frontend (UI + integrações): 5-7 dias
- Testes e ajustes: 3-4 dias

#### ⚠️ Riscos e Desafios
- **Baixo Risco:** Lógica simples, sem complexidade
- **Desafio:** Definir regras de cashback (percentual, limites, validade)
- **Consideração:** Pode expirar cashback após X meses (campo `expires_at`)

#### 💡 Recomendação
**IMPLEMENTAR** - Alta viabilidade, baixa complexidade, alto valor de negócio.

---

## 2. 💵 Sistema de Comissões Automáticas

### Viabilidade Técnica: ⭐⭐⭐⭐⭐ (Muito Alta)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Integração Direta:** Usa tabela `sales` existente
- **Cálculo Automático:** Pode usar trigger ou função RPC
- **Estrutura Simples:** Similar ao cashback
- **Já tem base:** Sistema de vendas e metas já existe

#### 📊 Estrutura de Dados Necessária

```sql
-- Configuração de comissões por loja/colaboradora
CREATE TABLE commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id), -- NULL = regra global
    colaboradora_id UUID REFERENCES profiles(id), -- NULL = regra para loja
    rule_type TEXT NOT NULL, -- 'PERCENTAGE' | 'FIXED' | 'TIERED'
    percentage DECIMAL(5,2), -- Para PERCENTAGE
    fixed_amount DECIMAL(10,2), -- Para FIXED
    tier_rules JSONB, -- Para TIERED (ex: 5% até R$1000, 7% acima)
    min_sale_value DECIMAL(10,2),
    active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Histórico de comissões
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    sale_value DECIMAL(10,2) NOT NULL,
    commission_percentage DECIMAL(5,2),
    commission_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'PAID' | 'CANCELLED'
    payment_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Saldo de comissões pendentes/pagas
CREATE TABLE commission_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    pending_amount DECIMAL(10,2) DEFAULT 0,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(colaboradora_id)
);
```

#### 🔧 Implementação Técnica

**Backend:**
- Trigger ou função RPC que calcula comissão ao criar venda
- Função para processar pagamento de comissões (mudar status de PENDING para PAID)
- Integração com adiantamentos (comissões podem ser usadas como garantia)

**Frontend:**
- Componente `CommissionBalance` no dashboard da colaboradora
- Página de histórico de comissões
- Admin pode configurar regras de comissão
- Relatório de comissões pendentes/pagas

#### ⏱️ Tempo Estimado: 2-3 semanas
- Backend (tabelas + triggers + RPCs): 4-5 dias
- Frontend (UI + configuração): 6-8 dias
- Testes e ajustes: 3-4 dias

#### ⚠️ Riscos e Desafios
- **Médio Risco:** Regras de comissão podem ser complexas (tiered, por categoria)
- **Desafio:** Definir quando comissão é paga (mensal, semanal, por venda)
- **Consideração:** Comissões podem ter diferentes percentuais por categoria de produto

#### 💡 Recomendação
**IMPLEMENTAR** - Alta viabilidade, estrutura similar ao cashback, alto valor de negócio.

---

## 4. 📊 Relatórios Avançados e Analytics

### Viabilidade Técnica: ⭐⭐⭐⭐ (Alta)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Dados Já Existem:** Todas as tabelas necessárias já estão no sistema
- **Bibliotecas Disponíveis:** Recharts já está instalado
- **Estrutura Pronta:** Já tem alguns relatórios básicos

#### 📊 Estrutura de Dados Necessária

**Não precisa de novas tabelas!** Usa dados existentes:
- `sales` - Vendas
- `goals` - Metas
- `profiles` - Colaboradoras
- `stores` - Lojas
- `purchases` - Compras
- `adiantamentos` - Adiantamentos

#### 🔧 Implementação Técnica

**Backend:**
- Funções RPC para agregar dados:
  - `get_sales_trends(start_date, end_date, store_id)`
  - `get_performance_comparison(period1, period2)`
  - `get_top_products(start_date, end_date)`
  - `get_forecast_data(store_id, months_ahead)`

**Frontend:**
- Página `AdvancedReports.tsx` com múltiplas abas:
  - **Tendências:** Gráfico de linha com evolução de vendas
  - **Comparação:** Comparar períodos (mês atual vs mês anterior)
  - **Top Produtos:** Produtos mais vendidos
  - **Previsões:** Projeções baseadas em histórico
  - **Análise de Colaboradoras:** Performance individual
- Filtros avançados:
  - Período (hoje, semana, mês, trimestre, ano, personalizado)
  - Loja (todas, específica)
  - Colaboradora (todas, específica)
  - Métricas (vendas, ticket médio, PA, etc)
- Exportação:
  - PDF (já tem jsPDF instalado)
  - Excel (já tem XLSX instalado)

#### ⏱️ Tempo Estimado: 3-4 semanas
- Backend (RPCs de agregação): 5-7 dias
- Frontend (gráficos e visualizações): 10-12 dias
- Exportação PDF/Excel: 3-4 dias
- Testes e ajustes: 4-5 dias

#### ⚠️ Riscos e Desafios
- **Médio Risco:** Queries complexas podem ser lentas com muitos dados
- **Desafio:** Otimização de queries (índices, materialized views)
- **Consideração:** Cache de relatórios para melhor performance

#### 💡 Recomendação
**IMPLEMENTAR** - Alta viabilidade, usa dados existentes, alto valor para tomada de decisão.

---

## 7. ⏰ Sistema de Folha de Ponto

### Viabilidade Técnica: ⭐⭐⭐⭐ (Alta)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Estrutura Simples:** Apenas registro de entrada/saída
- **Sem Dependências:** Não precisa de integrações externas
- **Integração Futura:** Pode integrar com sistema de comissões

#### 📊 Estrutura de Dados Necessária

```sql
-- Registros de ponto
CREATE TABLE time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    record_type TEXT NOT NULL, -- 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END'
    record_time TIMESTAMP NOT NULL DEFAULT NOW(),
    latitude DECIMAL(10,8), -- Para validação de localização
    longitude DECIMAL(11,8),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resumo de horas trabalhadas (calculado diariamente)
CREATE TABLE work_hours_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    work_date DATE NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    total_hours DECIMAL(5,2), -- Horas trabalhadas
    break_duration DECIMAL(4,2), -- Horas de intervalo
    effective_hours DECIMAL(5,2), -- Horas efetivas (total - intervalo)
    status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED'
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(colaboradora_id, work_date)
);

-- Banco de horas
CREATE TABLE hour_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    balance_hours DECIMAL(6,2) DEFAULT 0, -- Saldo de horas (positivo = crédito, negativo = débito)
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(colaboradora_id)
);

-- Solicitações de férias
CREATE TABLE vacation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED'
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 🔧 Implementação Técnica

**Backend:**
- Função RPC para registrar ponto (com validação de localização opcional)
- Função RPC para calcular horas trabalhadas diariamente
- Função RPC para aprovar/rejeitar registros
- Trigger para atualizar `work_hours_summary` automaticamente

**Frontend:**
- Componente `TimeClock` no dashboard da colaboradora:
  - Botão "Bater Ponto" (entrada/saída)
  - Mostra status atual (dentro/fora)
  - Histórico do dia
- Página de histórico de ponto:
  - Calendário com registros
  - Resumo mensal de horas
  - Banco de horas
- Admin/Loja:
  - Aprovar/rejeitar registros
  - Relatório de frequência
  - Solicitações de férias

#### ⏱️ Tempo Estimado: 3-4 semanas
- Backend (tabelas + triggers + RPCs): 5-6 dias
- Frontend (UI de ponto + histórico): 8-10 dias
- Validação de localização (opcional): 2-3 dias
- Testes e ajustes: 4-5 dias

#### ⚠️ Riscos e Desafios
- **Médio Risco:** Validação de localização pode ser complexa
- **Desafio:** Cálculo de horas trabalhadas (considerar intervalos, horas extras)
- **Consideração:** Pode precisar de validação de localização (GPS) para evitar fraudes

#### 💡 Recomendação
**IMPLEMENTAR** - Alta viabilidade, essencial para RH, pode integrar com comissões.

---

## 8. 🤖 Sistema de Metas Inteligentes (IA)

### Viabilidade Técnica: ⭐⭐⭐ (Média)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Dados Históricos Existem:** Tabela `sales` e `goals` têm histórico
- **Cálculos Simples:** Pode usar estatísticas básicas (média, tendência)

#### ⚠️ Pontos de Atenção
- **Não é IA Real:** Seria mais "sugestões inteligentes" baseadas em estatísticas
- **IA Real Requer:** Modelos de ML, treinamento, infraestrutura adicional
- **Complexidade:** Análise de sazonalidade, tendências, outliers

#### 📊 Estrutura de Dados Necessária

```sql
-- Sugestões de metas geradas pelo sistema
CREATE TABLE goal_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    colaboradora_id UUID REFERENCES profiles(id),
    goal_type TEXT NOT NULL, -- 'MENSAL' | 'INDIVIDUAL'
    suggested_value DECIMAL(10,2) NOT NULL,
    confidence_score DECIMAL(5,2), -- 0-100 (quão confiável é a sugestão)
    reasoning TEXT, -- Explicação da sugestão
    based_on_period_start DATE,
    based_on_period_end DATE,
    historical_data_points INTEGER, -- Quantos meses de histórico foram usados
    created_at TIMESTAMP DEFAULT NOW()
);

-- Configuração do algoritmo de sugestão
CREATE TABLE goal_suggestion_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id), -- NULL = global
    algorithm_type TEXT DEFAULT 'TREND', -- 'TREND' | 'AVERAGE' | 'SEASONAL' | 'ML'
    lookback_months INTEGER DEFAULT 6, -- Quantos meses olhar para trás
    growth_factor DECIMAL(5,2) DEFAULT 0, -- Fator de crescimento esperado (%)
    seasonal_adjustment BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 🔧 Implementação Técnica

**Backend (Versão Simples - Sem IA Real):**
- Função RPC `suggest_goal()` que:
  1. Busca histórico de vendas (últimos 6-12 meses)
  2. Calcula média, mediana, tendência
  3. Aplica fator de crescimento (se configurado)
  4. Ajusta por sazonalidade (se ativado)
  5. Retorna sugestão com score de confiança

**Backend (Versão Avançada - Com ML):**
- Requer infraestrutura adicional:
  - Python backend (FastAPI) ou Supabase Edge Functions com Deno
  - Biblioteca de ML (scikit-learn, TensorFlow.js)
  - Treinamento de modelo com dados históricos
  - API para predições

**Frontend:**
- Botão "Sugerir Meta" na página de gestão de metas
- Modal mostrando:
  - Valor sugerido
  - Score de confiança
  - Explicação (ex: "Baseado em média dos últimos 6 meses + 5% de crescimento")
  - Gráfico mostrando histórico usado
- Admin pode aceitar/rejeitar sugestão

#### ⏱️ Tempo Estimado

**Versão Simples (Estatísticas):** 2-3 semanas
- Backend (função de sugestão): 4-5 dias
- Frontend (UI de sugestão): 3-4 dias
- Testes: 2-3 dias

**Versão Avançada (ML):** 6-8 semanas
- Infraestrutura ML: 2-3 semanas
- Treinamento de modelo: 1-2 semanas
- Integração: 1-2 semanas
- Testes: 1 semana

#### ⚠️ Riscos e Desafios
- **Alto Risco (ML):** Requer conhecimento de ML, infraestrutura adicional
- **Médio Risco (Estatísticas):** Cálculos podem ser imprecisos sem dados suficientes
- **Desafio:** Definir algoritmo adequado (média simples? tendência? sazonalidade?)
- **Consideração:** Sugestões podem ser rejeitadas pelo admin (não é automático)

#### 💡 Recomendação
**IMPLEMENTAR VERSÃO SIMPLES PRIMEIRO** - Começar com estatísticas básicas (média, tendência), depois evoluir para ML se necessário. Viabilidade média para versão simples, baixa para versão ML completa.

---

## 11. 🏆 Gamificação com Badges e Conquistas

### Viabilidade Técnica: ⭐⭐⭐⭐ (Alta)

### Análise Detalhada

#### ✅ Pontos Positivos
- **Integração Simples:** Usa dados existentes (vendas, metas)
- **Estrutura Leve:** Apenas 2-3 tabelas
- **Alto Engajamento:** Aumenta motivação das colaboradoras

#### 📊 Estrutura de Dados Necessária

```sql
-- Definição de badges disponíveis
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Nome do ícone (lucide-react)
    badge_type TEXT NOT NULL, -- 'SALE' | 'GOAL' | 'STREAK' | 'SPECIAL'
    condition_type TEXT NOT NULL, -- 'FIRST_SALE' | 'SALES_COUNT' | 'GOAL_HIT' | 'STREAK_DAYS'
    condition_value INTEGER, -- Ex: 10 vendas, 5 dias seguidos
    rarity TEXT DEFAULT 'COMMON', -- 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Badges conquistadas por colaboradoras
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    badge_id UUID NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    progress INTEGER DEFAULT 0, -- Progresso atual (ex: 8/10 vendas)
    UNIQUE(colaboradora_id, badge_id)
);

-- Histórico de conquistas (para notificações)
CREATE TABLE badge_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID NOT NULL REFERENCES profiles(id),
    badge_id UUID NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    notified BOOLEAN DEFAULT false
);
```

#### 🔧 Implementação Técnica

**Backend:**
- Função RPC `check_badge_progress(colaboradora_id)` que:
  1. Busca todas as badges ativas
  2. Para cada badge, verifica se a condição foi atendida
  3. Se sim, adiciona em `user_badges`
  4. Envia notificação WhatsApp (opcional)
- Trigger ou função chamada após:
  - Nova venda criada
  - Meta batida
  - Login diário (para streaks)

**Frontend:**
- Componente `BadgesGallery` no dashboard da colaboradora:
  - Grid de badges (conquistadas e não conquistadas)
  - Badges conquistadas com animação
  - Badges não conquistadas com progresso (ex: "8/10 vendas")
  - Modal com detalhes da badge
- Página de ranking de badges:
  - Colaboradoras com mais badges
  - Badges raras conquistadas
- Notificação toast ao conquistar badge

#### ⏱️ Tempo Estimado: 2-3 semanas
- Backend (tabelas + funções de verificação): 4-5 dias
- Frontend (UI de badges + galeria): 6-8 dias
- Integração com notificações: 2 dias
- Testes e ajustes: 3-4 dias

#### ⚠️ Riscos e Desafios
- **Baixo Risco:** Lógica simples de verificação
- **Desafio:** Definir badges interessantes e balanceadas
- **Consideração:** Badges podem expirar ou ter níveis (bronze, prata, ouro)

#### 💡 Recomendação
**IMPLEMENTAR** - Alta viabilidade, baixa complexidade, alto engajamento.

---

## 📊 Resumo Comparativo

| Funcionalidade | Viabilidade | Complexidade | Tempo | Prioridade |
|---------------|-------------|--------------|-------|------------|
| 1. Cashback | ⭐⭐⭐⭐⭐ | Baixa | 2-3 sem | 🔥 Alta |
| 2. Comissões | ⭐⭐⭐⭐⭐ | Baixa | 2-3 sem | 🔥 Alta |
| 4. Relatórios | ⭐⭐⭐⭐ | Média | 3-4 sem | 🔥 Alta |
| 7. Folha Ponto | ⭐⭐⭐⭐ | Média | 3-4 sem | ⚡ Média |
| 8. Metas IA | ⭐⭐⭐ | Alta* | 2-3 sem* | 💡 Média |
| 11. Badges | ⭐⭐⭐⭐ | Baixa | 2-3 sem | ⚡ Média |

*Versão simples (estatísticas), não ML real

---

## 🎯 Recomendação de Ordem de Implementação

### Fase 1 (Alta Prioridade - 2-3 meses)
1. **Sistema de Comissões Automáticas** (2-3 semanas)
2. **Sistema de Cashback** (2-3 semanas)
3. **Relatórios Avançados** (3-4 semanas)

### Fase 2 (Média Prioridade - 1-2 meses)
4. **Gamificação com Badges** (2-3 semanas)
5. **Sistema de Folha de Ponto** (3-4 semanas)

### Fase 3 (Opcional)
6. **Sistema de Metas Inteligentes** (versão simples - 2-3 semanas)

---

## 💡 Considerações Finais

### Funcionalidades Mais Viáveis
- **Cashback e Comissões:** Estrutura muito similar, podem ser desenvolvidas em paralelo
- **Badges:** Leve, rápido, alto impacto no engajamento
- **Relatórios:** Usa dados existentes, apenas visualização

### Funcionalidades que Requerem Mais Atenção
- **Metas Inteligentes:** Começar simples (estatísticas), evoluir depois
- **Folha de Ponto:** Pode precisar de validação de localização (GPS)

### Sinergias entre Funcionalidades
- **Cashback + Comissões:** Podem compartilhar estrutura de cálculo
- **Badges + Comissões:** Badges podem ser desbloqueadas por performance
- **Relatórios + Todas:** Relatórios agregam dados de todas as funcionalidades

