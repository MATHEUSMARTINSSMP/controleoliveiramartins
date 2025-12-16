# EleveaOne - Sistema de Gestao Inteligente para Varejo

> **Transforme sua loja em uma maquina de vendas com automacao, fidelizacao e gestao inteligente.**

[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

---

## Indice

1. [Visao Geral](#visao-geral)
2. [Arquitetura Tecnica](#arquitetura-tecnica)
3. [Design e UI/UX](#design-e-uiux)
4. [Funcionalidades Principais](#funcionalidades-principais)
5. [Automacoes e Integracoes](#automacoes-e-integracoes)
6. [Sistema de WhatsApp](#sistema-de-whatsapp)
7. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
8. [Edge Functions e RPCs](#edge-functions-e-rpcs)
9. [Performance e Otimizacoes](#performance-e-otimizacoes)
10. [Planos e Precos](#planos-e-precos)
11. [Roadmap Futuro](#roadmap-futuro)
12. [Instalacao e Deploy](#instalacao-e-deploy)

---

## Visao Geral

O **EleveaOne** e uma plataforma SaaS Multi-Tenant completa para gestao de varejo, desenvolvida para lojas de moda, acessorios e comercio em geral. O sistema oferece:

- **Gestao de Vendas e Metas** com gamificacao e acompanhamento em tempo real
- **Sistema de Cashback Automatizado** com notificacoes via WhatsApp
- **CRM Completo** para relacionamento com clientes
- **Controle de Ponto Digital** em conformidade com a legislacao brasileira (REP-P)
- **Integracao com ERPs** (Tiny, Bling) para sincronizacao automatica
- **DRE e Relatorios Financeiros** com integracao N8N
- **Sistema de Adiantamentos** com controle de parcelas e limites
- **Alertas de Tarefas** recorrentes para lojas via WhatsApp
- **Check de Meta Diaria** gamificado com bonus configuravel

---

## Arquitetura Tecnica

### Stack Tecnologico

| Camada | Tecnologia | Descricao |
|--------|------------|-----------|
| **Frontend** | React 18 + TypeScript + Vite | SPA moderna com hot reload |
| **Estilizacao** | TailwindCSS + ShadcnUI | Design system consistente |
| **Backend** | Supabase (PostgreSQL) | BaaS com RLS nativo |
| **Edge Functions** | Supabase Edge (Deno) | Funcoes serverless de baixa latencia |
| **Serverless** | Netlify Functions (Node.js) | Integracoes e webhooks |
| **Automacoes** | N8N + Cron Jobs | Workflows automatizados |
| **WhatsApp** | UazAPI + N8N | Mensagens transacionais |
| **Emails** | Resend | Emails transacionais |
| **Animacoes** | Framer Motion | Transicoes e micro-interacoes |

### Estrutura do Repositorio

```
/
├── src/                      # Codigo fonte Frontend
│   ├── components/           # Componentes React reutilizaveis
│   │   ├── admin/            # Componentes do painel Admin
│   │   ├── loja/             # Componentes da visao Loja
│   │   ├── erp/              # Componentes de integracao ERP
│   │   ├── timeclock/        # Componentes de controle de ponto
│   │   └── ui/               # Componentes ShadcnUI base
│   ├── pages/                # Paginas da aplicacao
│   │   ├── admin/            # Paginas do Admin
│   │   ├── erp/              # Paginas de gestao ERP
│   │   └── dev/              # Paginas de desenvolvimento
│   ├── hooks/                # Custom Hooks (useAuth, useTimeClock, etc)
│   ├── lib/                  # Utilitarios e helpers
│   │   └── erp/              # Logica de sincronizacao ERP
│   ├── contexts/             # React Contexts (Auth, Theme)
│   └── integrations/         # Clientes de API (Supabase)
├── supabase/                 # Configuracoes Supabase
│   ├── migrations/           # Migrations SQL
│   └── functions/            # Edge Functions (Deno)
├── netlify/                  # Netlify Functions
│   └── functions/            # Funcoes serverless Node.js
└── public/                   # Assets estaticos
```

### Seguranca Multi-Tenant (RLS)

O sistema utiliza **Row Level Security (RLS)** no PostgreSQL para garantir isolamento total entre tenants:

- Todas as tabelas possuem `store_id` ou `admin_id`
- Policies garantem que usuarios so acessam dados da sua loja
- Schema dedicado: `sistemaretiradas`
- Credenciais WhatsApp isoladas por admin com fallback global

---

## Design e UI/UX

### Paleta de Cores Dual

O sistema possui um tema dual sofisticado e minimalista:

#### Tema Claro (Dourado/Bege)
| Cor | HSL | Uso |
|-----|-----|-----|
| **Primary** | `38 92% 50%` | Dourado vibrante - botoes, destaques |
| **Background** | `40 30% 97%` | Bege bem claro - fundo geral |
| **Card** | `40 25% 98%` | Bege quase branco - cards |
| **Secondary** | `40 20% 93%` | Bege medio - fundos secundarios |
| **Accent** | `35 30% 88%` | Bege acentuado - hovers |

#### Tema Escuro (Roxo/Violeta)
| Cor | HSL | Uso |
|-----|-----|-----|
| **Primary** | `262 60% 65%` | Violeta vibrante - botoes, destaques |
| **Background** | `262 20% 4%` | Preto-roxo profundo - fundo |
| **Card** | `262 18% 8%` | Roxo escuro - cards |
| **Secondary** | `262 15% 12%` | Roxo medio - fundos secundarios |

### Elementos de Design

- **Glassmorphism**: Efeitos de vidro fosco com blur
- **Orbs Animados**: Gradientes flutuantes no background
- **Glow Shadows**: Sombras com brilho sutil
- **Shimmer Loaders**: Skeletons com animacao de brilho
- **Page Transitions**: Transicoes suaves entre paginas (Framer Motion)
- **Animated Counters**: Numeros com animacao de incremento

---

## Funcionalidades Principais

### 1. Gestao de Vendas e Metas

- **Lancamento de Vendas** com formas de pagamento multiplas (Credito, Debito, PIX, Dinheiro, Boleto)
- **Metas Individuais e de Loja** (diarias, semanais, mensais)
- **Redistribuicao Automatica de Metas** quando colaboradora esta de folga
- **Super Meta** com bonificacoes especiais
- **Calendario Mensal** de vendas por colaboradora
- **Ranking de Performance** em tempo real
- **Graficos de Evolucao Diaria** com comparativo por loja

### 2. Check de Meta Diaria (Gamificado)

Sistema gamificado para incentivar colaboradoras a visualizar suas metas diariamente:

| Funcionalidade | Descricao |
|----------------|-----------|
| **Confirmacao Diaria** | Colaboradora confirma que viu a meta do dia |
| **Horario Limite** | Configuravel por loja (ex: ate 10h) |
| **Bonus por Consistencia** | Valor configuravel para quem confirma no prazo |
| **Dashboard Visual** | Mostra status de todas as colaboradoras |
| **Historico Mensal** | Registro de todas as confirmacoes |

### 3. Sistema de Cashback

| Funcionalidade | Descricao |
|----------------|-----------|
| **Geracao Automatica** | Cashback gerado automaticamente a cada venda |
| **Notificacao WhatsApp** | Cliente recebe mensagem com valor e validade |
| **Resgate Inteligente** | Sistema valida saldo e percentual maximo |
| **Expiracao Automatica** | Saldos expiram conforme configuracao |
| **Bonificacao Manual** | Admin pode creditar cashback para clientes |
| **Historico Completo** | Todas as transacoes rastreadas |
| **Data de Liberacao** | Cashback so fica disponivel apos periodo configurado |

**Campos da Tabela `cashback_transactions`:**
- `transaction_type`: EARNED, REDEEMED, EXPIRED
- `amount`: Valor da transacao
- `description`: Descricao
- `data_liberacao`: Data de liberacao do saldo
- `data_expiracao`: Data de expiracao

### 4. CRM (Customer Relationship Management)

- **Gestao de Contatos** com dados completos (CPF, telefone, email, aniversario)
- **Tarefas e Lembretes** com prioridades e status
- **Compromissos Agendados** com notificacoes
- **Pos-Venda Automatico** cria agendamento apos cada venda
- **Categorias de Clientes** (BLACK, PLATINUM, VIP, REGULAR) baseado em compras
- **Integracao com Wishlist** para avisar quando produto chegar

### 5. Wishlist (Lista de Desejos)

- Cadastro de produtos desejados por clientes
- Busca inteligente com autocomplete
- Especificacoes detalhadas (tamanho, cor, modelo)
- Data limite para aviso
- Botao WhatsApp para contato direto
- Integracao com CRM

### 6. Controle de Ponto Digital (REP-P Compliance)

Sistema em conformidade com **Portaria 671/2021** e **CLT**:

| Funcionalidade | Descricao |
|----------------|-----------|
| **Registro de Ponto** | Entrada, saida, intervalos |
| **Assinatura Digital** | PIN separado da senha (compliance) |
| **Validacoes Inteligentes** | Previne duplicados e erros de sequencia |
| **Banco de Horas** | Calculo automatico de credito/debito |
| **Lancamento Manual** | Admin cria registros quando necessario |
| **Solicitacao de Alteracao** | Colaboradora solicita correcoes |
| **Relatorios PDF** | Exportacao mensal profissional |
| **Notificacoes WhatsApp** | Aviso ao admin quando ponto e registrado |
| **Jornadas Configuraveis** | Horarios por colaboradora |

### 7. Sistema de Adiantamentos

Controle completo de adiantamentos salariais para colaboradoras:

| Funcionalidade | Descricao |
|----------------|-----------|
| **Solicitacao pela Colaboradora** | Portal para solicitar adiantamento |
| **Aprovacao pelo Admin** | Fluxo de aprovacao com justificativa |
| **Parcelamento Automatico** | Divisao em parcelas mensais |
| **Limite por Colaboradora** | Valor maximo configuravel |
| **Controle de Competencia** | Parcelas vinculadas ao mes de desconto |
| **Historico Completo** | Rastreamento de todas as solicitacoes |

**Validacoes de Limite:**
- Soma apenas parcelas da colaboradora especifica
- Considera adiantamentos aprovados e parcelas pendentes
- Bloqueia nova solicitacao se limite excedido

### 8. Alertas de Tarefas para Lojas

Sistema de lembretes recorrentes via WhatsApp:

| Funcionalidade | Descricao |
|----------------|-----------|
| **Tarefas Recorrentes** | Diaria, semanal, mensal |
| **Horario Configuravel** | Define hora de envio |
| **Dias da Semana** | Seleciona dias especificos |
| **Multiplos Destinatarios** | Envia para varios numeros |
| **Ativacao/Desativacao** | Controle por tarefa |
| **Templates de Mensagem** | Mensagens personalizaveis |

### 9. Sistema de Ajustes e Condicionais

- **Condicionais** para colaboradoras com status (PENDENTE, EM_PREPARO, PRONTO, ENTREGUE)
- **Ajustes** de valores com observacoes
- **Notificacoes WhatsApp** para clientes e colaboradoras
- **Historico Completo** de todas as movimentacoes

### 10. DRE (Demonstrativo de Resultado do Exercicio)

- **Integracao N8N** para busca de dados financeiros
- **Categorias de Receitas e Despesas** configuraveis
- **Relatorios por Periodo** (mensal, trimestral, anual)
- **Exportacao** para analise externa

### 11. Integracao ERP (Tiny/Bling)

| Funcionalidade | Descricao |
|----------------|-----------|
| **OAuth 2.0** | Autenticacao segura com refresh token |
| **Sincronizacao de Pedidos** | Automatica via webhook e cron |
| **Sincronizacao de Contatos** | Clientes importados do ERP |
| **Mapeamento de Vendedores** | Vincula vendedores do ERP com colaboradoras |
| **Logs de Sincronizacao** | Historico detalhado de todas as operacoes |
| **Multi-ERP Ready** | Estrutura preparada para Tiny, Bling e outros |

---

## Sistema de WhatsApp

### Arquitetura de Notificacoes

O sistema suporta multiplas fontes de envio WhatsApp com fallback automatico:

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE ENVIO                           │
├─────────────────────────────────────────────────────────────┤
│  1. Verifica WhatsApp da Loja (site_slug)                   │
│     ├─ Se conectado → Usa credenciais da loja              │
│     └─ Se nao conectado → Fallback para Global             │
│                                                             │
│  2. WhatsApp Global (is_global = true)                      │
│     ├─ Credencial compartilhada entre todas as lojas       │
│     └─ Requer admin_id para acesso via RLS                 │
│                                                             │
│  3. N8N Webhook                                             │
│     ├─ Processa fila de mensagens                          │
│     ├─ Busca credenciais via JOIN stores + credentials     │
│     └─ Envia via UazAPI                                    │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Notificacoes

| Tipo | Trigger | Conteudo |
|------|---------|----------|
| **Cashback Earned** | Venda processada | Valor ganho, saldo, validade |
| **Cashback Redeemed** | Resgate realizado | Valor usado, saldo restante |
| **Time Clock** | Registro de ponto | Tipo, horario, colaboradora |
| **Task Alert** | Cron configurado | Lembrete de tarefa |
| **Condicional** | Status alterado | Status atual, detalhes |

### Configuracao WhatsApp por Loja

```sql
-- Credenciais especificas da loja
INSERT INTO whatsapp_credentials (admin_id, site_slug, uazapi_token, uazapi_status)
VALUES ('uuid', 'minha-loja', 'token', 'connected');

-- Credencial global (fallback)
INSERT INTO whatsapp_credentials (admin_id, site_slug, is_global, uazapi_status)
VALUES ('uuid', 'elevea_global', true, 'connected');
```

---

## Automacoes e Integracoes

### Edge Functions (Supabase/Deno)

| Funcao | Descricao |
|--------|-----------|
| `sync-tiny-orders` | Sincroniza pedidos do Tiny ERP |
| `process-cashback-queue` | Processa fila de WhatsApp de cashback |
| `process-time-clock-notifications` | Envia notificacoes de ponto |
| `create-colaboradora` | Cria usuarios com validacao de limites |
| `send-welcome-email` | Email de boas-vindas |
| `reset-colaboradora-password` | Reset de senha seguro |

### Netlify Functions (Node.js)

| Funcao | Descricao |
|--------|-----------|
| `sync-tiny-orders-background` | Sincronizacao em background |
| `sync-tiny-contacts-background` | Importacao de contatos |
| `process-cashback-queue-cron` | Cron de processamento WhatsApp |

### Funcoes RPC (PostgreSQL)

#### Cashback
- `gerar_cashback(sale_id, tiny_order_id)` - Gera cashback automaticamente
- `expire_cashback()` - Expira saldos vencidos

#### Controle de Ponto
- `has_signature_pin(colaboradora_id)` - Verifica se tem PIN
- `set_signature_pin(admin_id, colaboradora_id, pin)` - Define PIN
- `validate_signature_pin(colaboradora_id, pin)` - Valida PIN
- `validate_time_clock_sequence(...)` - Valida sequencia logica

#### Triggers Automaticos
- `trg_gerar_cashback_new_sale` - Dispara cashback ao inserir venda
- `trg_send_time_clock_notification` - Notifica registro de ponto
- `trg_create_post_sale_schedule` - Cria agendamento pos-venda

### Cron Jobs

| Job | Frequencia | Descricao |
|-----|------------|-----------|
| Expiracao Cashback | Diario | Invalida saldos vencidos |
| Sync ERP | A cada 1 min | Sincroniza pedidos novos |
| Hard Sync ERP | Diario | Reconciliacao completa |
| Processamento WhatsApp | A cada 5 min | Envia mensagens pendentes |
| Alertas de Tarefas | Conforme config | Lembretes para lojas |

---

## Estrutura do Banco de Dados

### Schema: `sistemaretiradas`

#### Tabelas Core
- `stores` - Lojas (tenants)
- `profiles` - Usuarios do sistema
- `sales` - Vendas
- `goals` - Metas
- `bonuses` - Bonus e premiacoes

#### Tabelas de Cashback
- `cashback_settings` - Configuracoes por loja
- `cashback_transactions` - Historico de transacoes
- `cashback_balance` - Saldo dos clientes
- `cashback_whatsapp_queue` - Fila de notificacoes

#### Tabelas de CRM
- `crm_contacts` - Contatos de clientes
- `crm_tasks` - Tarefas
- `crm_commitments` - Compromissos
- `crm_post_sales` - Agendamentos pos-venda

#### Tabelas de Ponto
- `time_clock_records` - Registros de ponto
- `time_clock_digital_signatures` - Assinaturas digitais
- `time_clock_pins` - PINs de assinatura
- `time_clock_change_requests` - Solicitacoes de alteracao
- `time_clock_hours_balance` - Banco de horas
- `colaboradora_work_schedules` - Jornadas de trabalho
- `time_clock_notification_config` - Config notificacoes ponto

#### Tabelas de Adiantamentos
- `adiantamentos` - Solicitacoes de adiantamento
- `adiantamento_parcelas` - Parcelas de desconto

#### Tabelas de ERP
- `erp_integrations` - Configuracoes de integracao
- `erp_sync_logs` - Logs de sincronizacao
- `tiny_orders` - Pedidos sincronizados
- `tiny_contacts` - Contatos sincronizados

#### Tabelas de Notificacoes
- `whatsapp_credentials` - Credenciais WhatsApp (loja + global)
- `whatsapp_notification_config` - Configuracoes de notificacao
- `store_notifications` - Notificacoes da loja
- `store_notification_queue` - Fila de envio
- `store_task_alerts` - Alertas de tarefas recorrentes

#### Tabelas de Gamificacao
- `daily_goal_checks` - Check de meta diaria
- `daily_goal_check_config` - Configuracoes do check

---

## Performance e Otimizacoes

### Lazy Loading

Bibliotecas pesadas sao carregadas sob demanda:

```typescript
// Carregamento dinamico
const XLSX = await import('xlsx');
const jsPDF = await import('jspdf');
const { default: autoTable } = await import('jspdf-autotable');
```

### Prefetch System

Sistema inteligente de pre-carregamento de rotas:

- Analisa navegacao do usuario
- Pre-carrega componentes provaveis
- Reduz tempo de carregamento percebido

### Virtual Table

Renderizacao eficiente para grandes datasets:

- Apenas linhas visiveis sao renderizadas
- Scroll virtualizado
- Suporte a milhares de registros

### React Query Cache

```typescript
// Query keys estruturadas
queryKey: ['cashback', storeId, month]

// Invalidacao precisa
queryClient.invalidateQueries({ queryKey: ['cashback', storeId] });
```

### Error Boundaries

- Captura erros de renderizacao
- Exibe fallback amigavel
- Log de erros para debug

---

## Planos e Precos

| Funcionalidade | Starter (R$ 97) | Pro (R$ 197) | Enterprise (R$ 497) |
|----------------|:---------------:|:------------:|:-------------------:|
| Lojas | 1 | 3 | Ilimitadas |
| Colaboradoras | 5 | 15 | Ilimitadas |
| Cashback | Sim | Sim | Sim |
| CRM | Sim | Sim | Sim |
| Wishlist | Sim | Sim | Sim |
| Controle de Ponto | Sim | Sim | Sim |
| Check Meta Diaria | Sim | Sim | Sim |
| WhatsApp Integrado | - | Sim | Sim |
| Alertas de Tarefas | - | Sim | Sim |
| Integracao ERP | Sim | Sim | Sim |
| DRE Financeiro | - | Sim | Sim |
| Adiantamentos | - | Sim | Sim |
| Suporte | Email | WhatsApp | Prioritario 24/7 |

---

## Roadmap Futuro

### Integracao Linx Microvix (Em Desenvolvimento)

Homologacao como operador de fidelidade oficial para sistemas Linx POS:

| Endpoint | Funcao |
|----------|--------|
| `/api/linx/consulta` | Consulta saldo de cashback |
| `/api/linx/acumulo` | Acumula pontos/cashback |
| `/api/linx/resgate` | Resgata cashback |
| `/api/linx/estorno` | Estorna operacao |

**Requisitos Linx:**
- Resposta em < 3 segundos
- Token de autenticacao (max 600 chars)
- Formato JSON
- HTTP status codes padronizados

### NF-e (Nota Fiscal Eletronica)

- Emissao de notas fiscais
- Integracao com SEFAZ
- Independencia total de ERP externo

---

## Instalacao e Deploy

### Requisitos
- Node.js 18+
- Conta Supabase
- Conta Netlify (opcional)

### Desenvolvimento Local

```bash
# Instalar dependencias
npm install

# Configurar variaveis de ambiente
cp .env.example .env

# Iniciar servidor de desenvolvimento
npm run dev
```

### Variaveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
VITE_N8N_BASE_URL=https://seu-n8n.com
VITE_N8N_AUTH_HEADER=sua-chave-auth
```

### Timezone

Todos os timestamps do sistema usam **America/Sao_Paulo (UTC-3)**:

```typescript
const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
```

### Deploy

O sistema e deployado automaticamente via Replit Deployments.

---

## Contato e Suporte

- **Email:** suporte@eleveaone.com.br
- **WhatsApp:** Disponivel nos planos Pro e Enterprise

---

*Desenvolvido com React, TypeScript, Supabase e muita dedicacao para o varejo brasileiro.*
