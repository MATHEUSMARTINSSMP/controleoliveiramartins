# 🏪 Sistema de Controle Comercial e Financeiro - Oliveira Martins

Sistema completo de gestão para rede de lojas Oliveira Martins, oferecendo dashboards especializados para Administradores, Lojas e Colaboradoras com gestão de metas, vendas, compras, adiantamentos e relatórios avançados.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Instalação e Configuração](#instalação-e-configuração)
- [Deploy](#deploy)
- [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
- [Funcionalidades](#funcionalidades)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

## 🎯 Visão Geral

Sistema desenvolvido em 5 fases, oferecendo:

### Perfis de Usuário

1. **ADMIN** - Dashboard completo com:
   - KPIs comerciais e financeiros
   - Gerenciamento de metas hierárquicas (loja → colaboradora)
   - Gerenciamento de benchmarks (Ticket Médio, PA, Preço Médio)
   - Relatórios avançados com gráficos
   - Gestão de limites de colaboradoras
   - Gestão de bônus

2. **LOJA** - Dashboard da loja com:
   - Ranking de vendedores
   - Controle de compras e adiantamentos
   - Registro de vendas

3. **COLABORADORA** - Dashboard pessoal com:
   - Metas diárias ajustadas (com distribuição de déficit)
   - Progresso mensal com projeções
   - Super metas e ritmo necessário
   - Histórico de compras e parcelas
   - Adiantamentos

## 🛠 Tecnologias

- **Frontend:**
  - React 18.3.1
  - TypeScript 5.8.3
  - Vite 5.4.19
  - React Router DOM 6.30.1
  - Tailwind CSS 3.4.17
  - shadcn/ui (componentes UI)
  - Recharts 2.15.4 (gráficos)
  - date-fns 3.6.0
  - Sonner (notificações)

- **Backend:**
  - Supabase (PostgreSQL + Auth + RLS)
  - Functions Deno para emails

- **Deploy:**
  - Netlify (frontend)
  - Supabase (backend)

## 📁 Estrutura do Projeto

```
controleoliveiramartins-1/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── CommercialDashboard.tsx
│   │   │   └── FinancialDashboard.tsx
│   │   ├── colaboradora/
│   │   │   └── ColaboradoraCommercial.tsx
│   │   ├── ui/              # Componentes shadcn/ui
│   │   ├── MetasManagement.tsx
│   │   └── BonusManagement.tsx
│   ├── pages/
│   │   ├── AdminDashboard.tsx
│   │   ├── ColaboradoraDashboard.tsx
│   │   ├── LojaDashboard.tsx
│   │   ├── Relatorios.tsx
│   │   └── BenchmarksManagement.tsx
│   ├── hooks/
│   │   └── useGoalCalculation.ts  # Hook para cálculo de metas ajustadas
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   └── lib/
│       └── utils.ts
├── supabase/
│   ├── migrations/          # Migrations do banco de dados
│   └── functions/           # Edge Functions
├── netlify/
│   └── functions/           # Netlify Functions
└── netlify.toml            # Configuração Netlify
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ (recomendado usar nvm)
- npm ou bun
- Conta Supabase
- Conta Netlify

### Passo a Passo

1. **Clone o repositório:**
```bash
git clone <YOUR_GIT_URL>
cd controleoliveiramartins-1
```

2. **Instale as dependências:**
```bash
npm install
# ou
bun install
```

3. **Configure variáveis de ambiente:**

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

4. **Execute o projeto localmente:**
```bash
npm run dev
# ou
bun dev
```

O projeto estará disponível em `http://localhost:5173`

## 🔐 Variáveis de Ambiente

### Necessárias para o Frontend:

- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave pública do Supabase

### Configuração no Netlify:

1. Acesse: Netlify Dashboard → Site Settings → Environment variables
2. Adicione as variáveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

⚠️ **Importante:** Essas variáveis devem estar configuradas no Netlify para o deploy funcionar corretamente.

## 🗄 Estrutura do Banco de Dados

### Principais Tabelas

#### `profiles`
Armazena usuários (ADMIN, LOJA, COLABORADORA)
- `id` (UUID, PK)
- `name`, `email`, `role`
- `store_id` (FK → stores)
- `limite_total`, `limite_mensal`

#### `stores`
Lojas da rede
- `id` (UUID, PK)
- `name`
- `active` (boolean)

#### `goals`
Metas mensais e individuais
- `id` (UUID, PK)
- `tipo` (MENSAL | INDIVIDUAL)
- `mes_referencia` (YYYYMM)
- `store_id` (FK)
- `colaboradora_id` (FK, nullable)
- `meta_valor`, `super_meta_valor`
- `daily_weights` (JSONB) - Pesos diários (soma = 100%)

#### `sales`
Vendas realizadas
- `id` (UUID, PK)
- `colaboradora_id`, `store_id` (FKs)
- `valor`, `qtd_pecas`
- `data_venda` (timestamp)

#### `store_benchmarks`
Metas de qualidade por loja
- `id` (UUID, PK)
- `store_id` (FK)
- `ideal_ticket_medio`
- `ideal_pa`
- `ideal_preco_medio`

#### `analytics_daily_performance` (VIEW)
View agregada para analytics
- Agrupa vendas por dia, loja e colaboradora
- Calcula KPIs automaticamente

### RPCs (Funções)

- `calculate_goal_deficit()` - Calcula déficit acumulado
- `calculate_monthly_projection()` - Calcula projeção mensal
- `get_store_analytics()` - Retorna analytics agregados por loja

### Índices de Performance

- `idx_sales_colaboradora_data` - Otimiza queries de vendas por colaboradora
- `idx_sales_store_data` - Otimiza queries de vendas por loja
- `idx_goals_colaboradora_mes` - Otimiza busca de metas
- `idx_parcelas_competencia` - Otimiza filtros de parcelas
- E mais...

## ✨ Funcionalidades Principais

### FASE 1: UI da Colaboradora ✅
- Hook `useGoalCalculation` para cálculo de metas diárias ajustadas
- Componente `ColaboradoraCommercial` com UI premium
- Meta diária ajustada considerando déficit/poupança
- Distribuição de déficit nos dias úteis restantes
- Projeções e ritmo necessário

### FASE 2: Dashboard Comercial ✅
- Filtros de período (Hoje, Semana, Mês, Personalizado)
- Gráficos de evolução diária (Recharts)
- Comparação entre lojas
- Integração com benchmarks

### FASE 3: Relatórios Avançados ✅
- Tabs organizadas (Compras & Adiantamentos / Análise Comercial)
- Gráficos de evolução diária por loja
- Comparação com benchmarks (TM, PA, PM)
- Filtros avançados de período

### FASE 4: Benchmarks CRUD ✅
- Página de gerenciamento (`/admin/benchmarks`)
- CRUD completo de benchmarks
- Validação e feedback visual
- Atualização automática de KPIs

### FASE 5: Otimizações ✅
- RPCs no Supabase para cálculos otimizados
- Índices adicionais para performance
- Documentação completa

## 📊 Metas e Cálculos

### Metas Hierárquicas
1. **Meta de Loja (MENSAL)** - Meta mensal da loja
2. **Metas Individuais (INDIVIDUAL)** - Distribuídas entre colaboradoras

### Pesos Diários
- Cada meta possui `daily_weights` (JSONB)
- Pesos somam exatamente 100%
- Distribuição automática (65% até dia 15, 35% restante)
- Usado para cálculo de meta diária ajustada

### Meta Diária Ajustada
- Considera déficit acumulado
- Se atrasada: distribui déficit nos dias úteis restantes
- Se à frente: mantém meta padrão (não reduz)
- Calcula ritmo necessário para bater meta

## 🚢 Deploy

### Netlify

1. **Conecte o repositório:**
   - Netlify Dashboard → Add new site → Import from Git
   - Conecte GitHub/GitLab

2. **Configure variáveis de ambiente:**
   - Site Settings → Environment variables
   - Adicione: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`

3. **Configurações de build:**
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Deploy automático:**
   - Push para `main` → Deploy automático

### Supabase

1. **Aplicar migrations:**
   - Execute todas as migrations em `supabase/migrations/`
   - Ordem cronológica (por timestamp)

2. **Configurar RLS:**
   - Políticas já incluídas nas migrations
   - ADMIN vê tudo
   - LOJA vê apenas sua loja
   - COLABORADORA vê apenas seus dados

## 📝 Migrations

Execute as migrations na ordem:

1. `20251121000000_add_daily_weights.sql`
2. `20251121100000_add_store_id_to_profiles.sql`
3. `20251121101500_populate_store_id.sql`
4. `20251121120000_add_goals_admin_policies.sql`
5. `20251121130000_add_goals_unique_constraints.sql`
6. `20251121133000_fix_goals_upsert_index.sql`
7. `20251121140000_create_analytics_structure.sql`
8. `20251121141500_populate_benchmarks.sql`
9. `20251121150000_create_performance_rpcs.sql`
10. `20251121151000_add_performance_indexes.sql`

## 🔒 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Políticas por role (ADMIN, LOJA, COLABORADORA)
- Validação de dados no frontend e backend
- Tokens JWT do Supabase para autenticação

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Netlify](https://docs.netlify.com)
- [Documentação React Router](https://reactrouter.com)

## 📄 Licença

Proprietário - Oliveira Martins

---

**Desenvolvido com ❤️ para a rede Oliveira Martins**
