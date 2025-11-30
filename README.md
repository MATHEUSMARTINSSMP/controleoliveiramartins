# 🏪 Sistema de Controle Comercial e Financeiro - EleveaOne

Sistema completo de gestão para rede de lojas, oferecendo dashboards especializados para Administradores, Lojas e Colaboradoras com gestão de metas, vendas, compras, adiantamentos, integração ERP, inteligência de negócios, cashback e automações avançadas.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Instalação e Configuração](#instalação-e-configuração)
- [Deploy](#deploy)
- [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
- [Funcionalidades por Perfil](#funcionalidades-por-perfil)
- [Integrações](#integrações)
- [Automações](#automações)
- [Inteligências de Negócios](#inteligências-de-negócios)
- [Relatórios](#relatórios)
- [Variáveis de Ambiente](#variáveis-de-ambiente)

## 🎯 Visão Geral

Sistema desenvolvido em múltiplas fases, oferecendo gestão completa de operações comerciais, financeiras e de relacionamento com clientes.

### Perfis de Usuário

1. **ADMIN** - Dashboard completo com gestão total do sistema
2. **LOJA** - Dashboard da loja com gestão de vendas e equipe
3. **COLABORADORA** - Dashboard pessoal com metas e histórico
4. **DEV** - Acesso para desenvolvimento e testes

## 🛠 Tecnologias

### Frontend
- **React 18.3.1** - Framework principal
- **TypeScript 5.8.3** - Tipagem estática
- **Vite 5.4.19** - Build tool e dev server
- **React Router DOM 6.30.1** - Roteamento
- **Tailwind CSS 3.4.17** - Estilização
- **shadcn/ui** - Componentes UI reutilizáveis
- **Recharts 2.15.4** - Gráficos e visualizações
- **date-fns 3.6.0** - Manipulação de datas
- **Sonner** - Notificações toast
- **XLSX** - Exportação para Excel
- **jsPDF** - Geração de PDFs

### Backend
- **Supabase** - PostgreSQL + Auth + RLS + Realtime
- **Supabase Edge Functions (Deno)** - Funções serverless
- **pg_cron** - Agendamento de tarefas no PostgreSQL
- **Netlify Functions (Node.js)** - Funções serverless para proxy e integrações

### Integrações
- **Tiny ERP API** - Sincronização de pedidos, produtos, clientes e vendedores
- **WhatsApp (n8n)** - Envio de notificações via webhook
- **Resend** - Envio de emails transacionais

### Deploy
- **Netlify** - Frontend e Netlify Functions
- **Supabase** - Banco de dados, Auth, Edge Functions

## 📁 Estrutura do Projeto

```
controleoliveiramartins-1/
├── src/
│   ├── components/
│   │   ├── admin/              # Componentes do painel admin
│   │   │   ├── CommercialDashboard.tsx
│   │   │   └── FinancialDashboard.tsx
│   │   ├── colaboradora/       # Componentes do painel colaboradora
│   │   │   └── ColaboradoraCommercial.tsx
│   │   ├── erp/                # Componentes do ERP
│   │   │   ├── TinyOrdersList.tsx
│   │   │   └── TinyContactsList.tsx
│   │   ├── loja/               # Componentes do painel loja
│   │   │   └── TrophiesGallery.tsx
│   │   ├── ui/                 # Componentes shadcn/ui
│   │   ├── MetasManagement.tsx
│   │   ├── BonusManagement.tsx
│   │   ├── WeeklyGoalsManagement.tsx
│   │   └── WeeklyGoalProgress.tsx
│   ├── pages/
│   │   ├── AdminDashboard.tsx      # Dashboard principal admin
│   │   ├── ColaboradoraDashboard.tsx # Dashboard colaboradora
│   │   ├── LojaDashboard.tsx       # Dashboard loja
│   │   ├── Relatorios.tsx           # Relatórios avançados
│   │   ├── BenchmarksManagement.tsx # Gestão de benchmarks
│   │   ├── Colaboradores.tsx        # CRUD colaboradoras
│   │   ├── NovaCompra.tsx           # Registrar compra
│   │   ├── NovoAdiantamento.tsx     # Criar adiantamento
│   │   ├── Adiantamentos.tsx         # Listar adiantamentos
│   │   ├── SolicitarAdiantamento.tsx # Solicitar adiantamento
│   │   ├── Lancamentos.tsx           # Lançamentos financeiros
│   │   ├── erp/                     # Páginas do ERP
│   │   │   ├── ERPDashboard.tsx
│   │   │   ├── ERPLogin.tsx
│   │   │   ├── CashbackManagement.tsx
│   │   │   ├── CategoryReports.tsx
│   │   │   ├── CustomerIntelligence.tsx
│   │   │   └── ProductSalesIntelligence.tsx
│   │   └── dev/                     # Páginas de desenvolvimento
│   │       ├── DevLogin.tsx
│   │       └── ERPConfig.tsx
│   ├── hooks/
│   │   └── useGoalCalculation.ts   # Hook para cálculo de metas
│   ├── contexts/
│   │   └── AuthContext.tsx          # Contexto de autenticação
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib/
│   │   ├── erp/
│   │   │   └── syncTiny.ts          # Funções de sincronização Tiny
│   │   ├── whatsapp.ts              # Funções WhatsApp
│   │   ├── trophies.ts              # Sistema de troféus
│   │   └── storeLogo.ts             # Logos das lojas
│   └── App.tsx
├── supabase/
│   ├── migrations/                  # Migrations do banco
│   └── functions/                   # Edge Functions (Deno)
│       ├── sync-tiny-orders/
│       ├── create-colaboradora/
│       ├── send-welcome-email/
│       └── ...
├── netlify/
│   └── functions/                   # Netlify Functions (Node.js)
│       ├── sync-tiny-orders-background.js
│       ├── sync-tiny-contacts-background.js
│       ├── send-whatsapp-message.js
│       ├── cashback-redeem.js
│       └── ...
└── netlify.toml
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ (recomendado usar nvm)
- npm ou bun
- Conta Supabase
- Conta Netlify
- Conta Tiny ERP (para integração)
- Webhook n8n (para WhatsApp)

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

### Frontend (`.env.local`)
- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave pública do Supabase

### Netlify Functions (Netlify Dashboard)
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço do Supabase
- `WHATSAPP_WEBHOOK_URL` - URL do webhook n8n (opcional)
- `WHATSAPP_WEBHOOK_AUTH` - Token de autenticação do webhook (opcional)
- `RESEND_API_KEY` - Chave da API Resend (para emails)

### Supabase (app_config table)
- `supabase_url` - URL do Supabase (para cron jobs)
- `service_role_key` - Chave de serviço (para cron jobs)
- `tiny_api_token_*` - Tokens da API Tiny por loja

⚠️ **Importante:** Variáveis sensíveis devem estar na tabela `app_config` do Supabase, não hardcoded no código.

## 🗄 Estrutura do Banco de Dados

### Principais Tabelas

#### `profiles`
Usuários do sistema (ADMIN, LOJA, COLABORADORA)
- `id` (UUID, PK)
- `name`, `email`, `role`
- `store_id` (FK → stores)
- `limite_total`, `limite_mensal`
- `store_default`, `whatsapp`
- `active` (boolean)

#### `stores`
Lojas da rede
- `id` (UUID, PK)
- `name`, `active`
- `admin_id` (FK → profiles)
- `sistema_erp` (string)

#### `goals`
Metas mensais e individuais
- `id` (UUID, PK)
- `tipo` (MENSAL | INDIVIDUAL)
- `mes_referencia` (YYYYMM)
- `store_id` (FK)
- `colaboradora_id` (FK, nullable)
- `meta_valor`, `super_meta_valor`
- `daily_weights` (JSONB) - Pesos diários (soma = 100%)
- `recebeMeta` (boolean)

#### `weekly_goals`
Metas semanais
- `id` (UUID, PK)
- `colaboradora_id` (FK)
- `week_number`, `year`
- `meta_valor`, `super_meta_valor`
- `bonus_valor`

#### `sales`
Vendas realizadas (manuais)
- `id` (UUID, PK)
- `colaboradora_id`, `store_id` (FKs)
- `valor`, `qtd_pecas`
- `data_venda` (timestamp)
- `observacoes`, `formas_pagamento` (JSONB)

#### `tiny_orders`
Pedidos sincronizados do Tiny ERP
- `id` (UUID, PK)
- `store_id`, `tiny_id`, `numero_pedido`
- `cliente_id` (FK → tiny_contacts)
- `colaboradora_id` (FK → profiles)
- `data_pedido`, `valor_total`
- `forma_pagamento`, `vendedor_nome`
- `itens` (JSONB), `sync_at`

#### `tiny_contacts`
Clientes sincronizados do Tiny ERP
- `id` (UUID, PK)
- `store_id`, `tiny_id`
- `nome`, `cpf_cnpj`, `telefone`
- `email`, `endereco` (JSONB)

#### `tiny_products`
Produtos sincronizados do Tiny ERP
- `id` (UUID, PK)
- `store_id`, `tiny_id`
- `nome`, `codigo`, `sku`
- `categoria`, `marca`, `preco`

#### `cashback_transactions`
Transações de cashback
- `id` (UUID, PK)
- `cliente_id` (FK → tiny_contacts)
- `tiny_order_id` (FK → tiny_orders)
- `transaction_type` (EARNED | REDEEMED)
- `valor`, `saldo_anterior`, `saldo_atual`
- `data_liberacao`, `data_expiracao`
- `status` (PENDENTE | LIBERADO | EXPIRADO | RESGATADO)

#### `store_benchmarks`
Metas de qualidade por loja
- `id` (UUID, PK)
- `store_id` (FK)
- `ideal_ticket_medio`
- `ideal_pa` (Peças por Atendimento)
- `ideal_preco_medio`

#### `app_config`
Configurações do sistema
- `key` (TEXT, PK)
- `value` (TEXT)
- `description` (TEXT)

#### `whatsapp_notification_config`
Configuração de notificações WhatsApp
- `id` (UUID, PK)
- `admin_id` (FK → profiles)
- `store_id` (FK → stores, nullable)
- `notification_type` (VENDA | COMPRA | etc.)
- `phone` (TEXT)
- `active` (boolean)

#### `erp_sync_logs`
Logs de sincronização ERP
- `id` (UUID, PK)
- `tipo_sync` (TEXT)
- `status` (TEXT)
- `registros_sincronizados`, `registros_atualizados`
- `registros_com_erro`
- `sync_at` (timestamp)
- `error_message` (TEXT)

### Views e RPCs

#### Views
- `analytics_daily_performance` - Agregação de performance diária
- Views de cashback e vendas agregadas

#### RPCs (Funções)
- `calculate_goal_deficit()` - Calcula déficit acumulado
- `calculate_monthly_projection()` - Calcula projeção mensal
- `get_store_analytics()` - Retorna analytics agregados por loja
- `chamar_sync_tiny_orders(p_tipo_sync TEXT)` - Chama sincronização via cron

### Índices de Performance
- `idx_sales_colaboradora_data` - Otimiza queries de vendas por colaboradora
- `idx_sales_store_data` - Otimiza queries de vendas por loja
- `idx_goals_colaboradora_mes` - Otimiza busca de metas
- `idx_parcelas_competencia` - Otimiza filtros de parcelas
- `idx_tiny_orders_numero_pedido_store_id` - Otimiza busca de pedidos
- E mais...

## ✨ Funcionalidades por Perfil

### 👑 Painel ADMIN

#### Dashboard Principal
- **KPIs Comerciais:**
  - Total de vendas (hoje, semana, mês)
  - Ticket médio
  - Peças por atendimento (PA)
  - Preço médio
  - Comparação com benchmarks
  - Evolução diária com gráficos

- **KPIs Financeiros:**
  - Total de compras
  - Total de adiantamentos
  - Saldo de parcelas pendentes
  - Análise de fluxo de caixa

#### Gestão de Metas
- **Metas Mensais:**
  - Criar/editar metas de loja
  - Distribuir metas entre colaboradoras
  - Configurar pesos diários (distribuição ao longo do mês)
  - Super metas
  - Metas dinâmicas (ajuste automático baseado em progresso)

- **Metas Semanais:**
  - Configurar metas semanais por colaboradora
  - Bônus semanais
  - Acompanhamento de progresso

#### Gestão de Colaboradoras
- CRUD completo de colaboradoras
- Definir limites (total e mensal)
- Ativar/desativar colaboradoras
- Gerenciar senhas
- Associar a lojas

#### Gestão de Benchmarks
- Configurar Ticket Médio ideal por loja
- Configurar PA (Peças por Atendimento) ideal
- Configurar Preço Médio ideal
- Comparação automática com vendas reais

#### Gestão de Bônus
- Criar/editar bônus
- Associar a metas ou vendas
- Histórico de bônus pagos

#### Relatórios Avançados
- **Análise Comercial:**
  - Gráficos de evolução diária por loja
  - Comparação entre lojas
  - Análise de performance por colaboradora
  - Filtros de período (hoje, semana, mês, personalizado)

- **Análise Financeira:**
  - Relatório de compras
  - Relatório de adiantamentos
  - Relatório de parcelas
  - Exportação para Excel/PDF

#### Sistema ERP
- **Dashboard ERP:**
  - KPIs de pedidos sincronizados
  - Total de pedidos, clientes, vendas
  - Ticket médio
  - Sincronização manual (Agora, Semana, Total)
  - Lista de pedidos sincronizados com filtros

- **Inteligência de Produtos:**
  - Análise de vendas por produto
  - Produtos mais vendidos
  - Análise por categoria
  - Análise por marca
  - Tendências de vendas

- **Inteligência de Clientes:**
  - Análise de clientes
  - Clientes mais frequentes
  - Análise de recorrência
  - Segmentação de clientes

- **Relatórios por Categoria:**
  - Vendas por categoria
  - Performance de categorias
  - Análise comparativa

- **Gestão de Cashback:**
  - Lançar cashback manualmente
  - Resgatar cashback
  - Histórico de transações
  - Saldo disponível vs pendente
  - Validade do cashback
  - Busca progressiva de clientes

#### Configurações
- Configurar integrações ERP
- Configurar notificações WhatsApp
- Gerenciar tokens de API
- Configurações gerais do sistema

### 🏪 Painel LOJA

#### Dashboard Principal
- **KPIs da Loja:**
  - Vendas do dia (com meta diária dinâmica)
  - Progresso mensal
  - Ranking de colaboradoras
  - Top 3 do mês
  - Troféus semanais e mensais

- **Metas:**
  - Meta mensal da loja
  - Meta diária dinâmica (ajustada automaticamente)
  - Progresso visual com barras
  - Projeções e ritmo necessário

#### Gestão de Vendas
- **Registrar Vendas:**
  - Selecionar colaboradora
  - Informar valor e quantidade de peças
  - Múltiplas formas de pagamento
  - Observações
  - Envio automático de WhatsApp

- **Lista de Vendas:**
  - Visualizar todas as vendas do dia
  - Filtrar por data
  - Editar/Excluir vendas
  - Totais atualizados automaticamente

#### Ranking e Performance
- Ranking de colaboradoras (hoje e mês)
- Top 3 do mês com destaque
- Performance individual
- Histórico de 7 dias

#### Metas Semanais
- Visualizar metas semanais das colaboradoras
- Acompanhar progresso
- Bônus semanais
- Troféus semanais

#### Troféus
- Galeria de troféus semanais
- Galeria de troféus mensais
- Histórico de conquistas

#### Relatórios
- Exportar vendas para Excel
- Exportar para PDF
- Relatórios personalizados

### 👤 Painel COLABORADORA

#### Dashboard Pessoal
- **Metas:**
  - Meta diária ajustada (considera déficit/poupança)
  - Progresso mensal
  - Super meta
  - Ritmo necessário para bater meta
  - Projeções

- **Performance:**
  - Vendas do dia
  - Vendas do mês
  - Posição no ranking
  - Progresso visual

#### Compras e Parcelas
- Listar compras realizadas
- Visualizar parcelas pendentes
- Calendário mensal de parcelas
- Status de cada parcela

#### Adiantamentos
- Solicitar adiantamento
- Visualizar adiantamentos aprovados
- Histórico de adiantamentos
- Status das solicitações

#### Limites
- Limite total disponível
- Limite mensal disponível
- Limite usado
- Alertas quando próximo do limite

## 🔗 Integrações

### Tiny ERP

#### Sincronização Automática
- **Cron Jobs (pg_cron):**
  - A cada 1 minuto: Busca apenas vendas novas (polling inteligente)
  - A cada 1 hora: Últimas vendas da última hora (apenas atualizações)
  - A cada 24 horas: Vendas das últimas 24h (apenas atualizações)
  - A cada 6 dias: Últimos 7 dias (apenas atualizações)
  - A cada 29 dias: Últimos 30 dias (apenas atualizações)
  - A cada 60 dias: Desde sempre (hard sync, sem filtro de data)
  - Diário às 3h: Resumo diário (últimas 24h)

#### Sincronização Manual
- **Sincronizar Agora:** Busca últimas vendas (últimas 12 horas, apenas novas)
- **Sincronizar Semana:** Busca últimos 7 dias (apenas atualizações)
- **Sincronização Total:** Atualiza últimos 90 dias (apenas se houver mudanças)

#### Dados Sincronizados
- **Pedidos:**
  - Número do pedido, data, valor
  - Cliente (nome, CPF/CNPJ, telefone)
  - Vendedor/Colaboradora (vinculação automática)
  - Formas de pagamento e parcelas
  - Itens com categorias, tamanhos, cores
  - Status do pedido

- **Clientes:**
  - Dados completos do cliente
  - Endereços
  - Histórico de compras

- **Produtos:**
  - Informações completas
  - Categorias e marcas
  - Variações (tamanho, cor)

- **Vendedores:**
  - Vinculação automática com colaboradoras
  - Busca por CPF, email ou nome

#### Notificações em Tempo Real
- Atualização automática via Supabase Realtime
- Notificações push quando nova venda chega
- Venda aparece automaticamente no topo da lista

### WhatsApp

#### Integração via n8n
- Webhook configurável
- Autenticação via header `x-app-key`
- Suporte a múltiplos destinatários

#### Notificações Automáticas
- **Vendas Manuais (LojaDashboard):**
  - Envio automático ao registrar venda
  - Mensagem formatada com:
    - Colaboradora, Loja, Cliente
    - Valor, Quantidade de Peças
    - Formas de Pagamento (detalhadas)
    - Data (fuso horário correto)
    - Totais do dia e mês
    - Peças Vendidas (produtos formatados)

- **Vendas do ERP (Tiny):**
  - Envio automático quando nova venda é sincronizada
  - Mesma formatação das vendas manuais
  - Produtos formatados (apenas descrição e quantidade)
  - Formas de pagamento detalhadas (todas com valores)

#### Configuração
- Configurar destinatários por loja
- Configurar destinatários globais (todas as lojas)
- Ativar/desativar por tipo de notificação
- Múltiplos números por configuração

### Email (Resend)

#### Funcionalidades
- Email de boas-vindas para novas colaboradoras
- Recuperação de senha
- Notificações administrativas

## ⚙️ Automações

### Sincronização Automática (pg_cron)

#### Jobs Configurados
1. **incremental_1min** - A cada 1 minuto
   - Busca apenas vendas novas
   - Polling inteligente (para ao encontrar venda existente)
   - Não busca vendas antigas

2. **ultima_hora** - A cada 1 hora
   - Últimas vendas da última hora
   - Apenas atualizações (se não houver mudanças, pula)

3. **ultimo_dia** - A cada 24 horas
   - Vendas das últimas 24h
   - Apenas atualizações

4. **ultimos_7_dias** - A cada 6 dias
   - Vendas dos últimos 7 dias
   - Apenas atualizações

5. **ultimos_30_dias** - A cada 29 dias
   - Vendas dos últimos 30 dias
   - Apenas atualizações

6. **hard_sync** - A cada 60 dias
   - Sincronização completa (sem filtro de data)
   - Garante que nada foi perdido

7. **resumo_diario** - Diário às 3h
   - Resumo das últimas 24h
   - Para relatórios e análises

### Cashback Automático

#### Geração Automática
- Trigger no banco gera cashback automaticamente
- 15% do valor da venda (configurável)
- Liberação em 2 dias úteis
- Validade de 90 dias

#### Expiração Automática
- Cron job marca cashback expirado
- Atualização automática de status

### Notificações Automáticas
- WhatsApp automático para novas vendas
- Notificações push no frontend
- Atualização em tempo real via Realtime

## 🧠 Inteligências de Negócios

### Inteligência de Produtos
- **Análise de Vendas:**
  - Produtos mais vendidos
  - Análise por categoria
  - Análise por marca
  - Tendências de vendas
  - Produtos em alta/baixa

- **Métricas:**
  - Quantidade vendida
  - Valor total vendido
  - Ticket médio por produto
  - Frequência de venda

### Inteligência de Clientes
- **Análise de Clientes:**
  - Clientes mais frequentes
  - Análise de recorrência
  - Segmentação de clientes
  - Histórico de compras
  - Valor total por cliente

- **Métricas:**
  - Frequência de compra
  - Ticket médio do cliente
  - Última compra
  - Total gasto

### Inteligência de Categorias
- **Análise por Categoria:**
  - Vendas por categoria
  - Performance de categorias
  - Comparação entre categorias
  - Tendências por categoria

### Inteligência de Vendas
- **Análise Temporal:**
  - Evolução diária
  - Evolução semanal
  - Evolução mensal
  - Sazonalidade

- **Análise Comparativa:**
  - Comparação entre lojas
  - Comparação entre colaboradoras
  - Comparação com benchmarks
  - Análise de performance

## 📊 Relatórios

### Relatórios Comerciais
- **Evolução Diária:**
  - Gráficos de linha
  - Comparação entre lojas
  - Filtros de período

- **Performance:**
  - Por loja
  - Por colaboradora
  - Por período

- **Benchmarks:**
  - Comparação com Ticket Médio ideal
  - Comparação com PA ideal
  - Comparação com Preço Médio ideal

### Relatórios Financeiros
- **Compras:**
  - Lista de compras
  - Total por colaboradora
  - Total por loja
  - Exportação Excel/PDF

- **Adiantamentos:**
  - Lista de adiantamentos
  - Status (Pendente, Aprovado, Recusado)
  - Total por colaboradora
  - Exportação Excel/PDF

- **Parcelas:**
  - Calendário mensal
  - Parcelas pendentes
  - Parcelas agendadas
  - Exportação Excel/PDF

### Relatórios ERP
- **Pedidos Sincronizados:**
  - Lista completa de pedidos
  - Filtros por status, data, cliente
  - Busca por número, cliente, vendedor
  - Exportação Excel/PDF

- **Análise de Vendas:**
  - Por produto
  - Por cliente
  - Por categoria
  - Por período

## 💰 Sistema de Cashback

### Funcionalidades
- **Geração Automática:**
  - 15% do valor da venda (configurável)
  - Gerado automaticamente via trigger
  - Liberação em 2 dias úteis
  - Validade de 90 dias

- **Lançamento Manual:**
  - Lançar cashback manualmente
  - Busca progressiva de clientes
  - Valor configurável

- **Resgate:**
  - Resgatar cashback disponível
  - Busca progressiva de clientes
  - Histórico de resgates

- **Visualização:**
  - Saldo disponível (considera data_liberacao)
  - Saldo pendente (será liberado em até 2 dias)
  - Histórico completo de transações
  - Validade do cashback
  - Filtros por tipo (EARNED, REDEEMED)

## 🎯 Sistema de Metas

### Metas Mensais
- **Hierarquia:**
  - Meta de Loja (MENSAL)
  - Metas Individuais (INDIVIDUAL) - Distribuídas entre colaboradoras

- **Pesos Diários:**
  - Distribuição ao longo do mês
  - Soma exatamente 100%
  - Distribuição automática (65% até dia 15, 35% restante)
  - Configurável manualmente

- **Meta Diária Ajustada:**
  - Considera déficit acumulado
  - Se atrasada: distribui déficit nos dias úteis restantes
  - Se à frente: mantém meta padrão (não reduz)
  - Calcula ritmo necessário para bater meta

- **Super Metas:**
  - Meta adicional (além da meta normal)
  - Bônus associado
  - Acompanhamento separado

### Metas Semanais
- **Configuração:**
  - Meta semanal por colaboradora
  - Super meta semanal
  - Bônus semanal

- **Acompanhamento:**
  - Progresso visual
  - Troféus semanais
  - Ranking semanal

## 🏆 Sistema de Troféus

### Troféus Semanais
- Gerados automaticamente ao bater meta semanal
- Galeria de troféus
- Histórico de conquistas

### Troféus Mensais
- Gerados automaticamente ao bater meta mensal
- Galeria de troféus
- Histórico de conquistas

## 📱 Notificações

### Frontend (Realtime)
- Notificações push quando nova venda chega
- Balãozinho de notificação
- Atualização automática da lista
- Sem necessidade de refresh manual

### WhatsApp
- Notificações automáticas de vendas
- Configurável por loja
- Múltiplos destinatários
- Formatação rica de mensagens

## 🔒 Segurança

### Autenticação
- Supabase Auth (JWT)
- Roles: ADMIN, LOJA, COLABORADORA, DEV
- Recuperação de senha
- Reset de senha por admin

### Row Level Security (RLS)
- Políticas por role em todas as tabelas
- ADMIN vê tudo
- LOJA vê apenas sua loja
- COLABORADORA vê apenas seus dados

### Configurações Sensíveis
- Chaves de API na tabela `app_config`
- Não hardcoded no código
- Acesso restrito via RLS

## 🚢 Deploy

### Netlify

1. **Conecte o repositório:**
   - Netlify Dashboard → Add new site → Import from Git
   - Conecte GitHub/GitLab

2. **Configure variáveis de ambiente:**
   - Site Settings → Environment variables
   - Adicione todas as variáveis necessárias

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
   - Verificar se todas estão ativas

3. **Configurar Edge Functions:**
   - Deploy das Edge Functions
   - Configurar variáveis de ambiente

4. **Configurar pg_cron:**
   - Executar migration de setup de cron jobs
   - Verificar se jobs estão ativos

## 📝 Migrations Importantes

Execute as migrations na ordem cronológica:

1. Migrations de estrutura base
2. Migrations de metas e benchmarks
3. Migrations de ERP (tiny_orders, tiny_contacts, etc.)
4. Migrations de cashback
5. Migrations de cron jobs
6. Migrations de índices e otimizações

## 🐛 Troubleshooting

### Sincronização não funciona
- Verificar se tokens da API Tiny estão configurados
- Verificar logs do Netlify Functions
- Verificar logs do Supabase Edge Functions
- Verificar se cron jobs estão ativos

### Notificações não aparecem
- Verificar se Realtime está habilitado no Supabase
- Verificar configuração de notificações WhatsApp
- Verificar logs do frontend (console)

### Cashback não está sendo gerado
- Verificar se trigger está criado
- Verificar logs do banco
- Verificar se pedido tem valor_total > 0

## 📞 Suporte

Para dúvidas ou problemas:
- Verificar logs no Netlify Functions
- Verificar logs no Supabase Edge Functions
- Verificar logs do frontend (console do navegador)
- Consultar documentação das APIs:
  - [Tiny ERP API](https://erp.tiny.com.br/public-api/v3/swagger/index.html)
  - [Supabase Docs](https://supabase.com/docs)
  - [Netlify Docs](https://docs.netlify.com)

## 📄 Licença

Proprietário - EleveaOne / Oliveira Martins

---

**Desenvolvido com ❤️ para a rede Oliveira Martins**

**Versão:** 2.0  
**Última atualização:** Janeiro 2025
