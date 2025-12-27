# Sistema de Retiradas - Multi-tenant ERP/Sales Management

## Overview
Sistema de Retiradas is a comprehensive multi-tenant ERP/sales management SaaS system designed to streamline business operations. It features subscription-based licensing, integration with Tiny ERP for order and contact synchronization, a cashback system with WhatsApp notifications, and robust sales tracking with goals, bonuses, and reporting. The project aims to provide an elegant, chic, minimalist, and futuristic user experience, adhering to Brazilian labor law compliance for time clock management, and offering multi-store support.

## User Preferences
- Keep code clean and well-organized
- Follow existing patterns for multi-tenancy and RLS
- Maintain security with proper role-based access
- Use TypeScript for type safety
- Follow React best practices with hooks and functional components

## System Architecture
The system is built with a modern web stack, emphasizing a chic, minimalist, and futuristic UI/UX.

-   **Frontend**: React, TypeScript, Vite, TailwindCSS, and shadcn/ui provide a responsive and modern user interface.
-   **Backend**: Supabase, utilizing PostgreSQL for the database and Edge Functions for serverless logic.
-   **Multi-tenancy**: Implemented via Row Level Security (RLS) policies within the `sistemaretiradas` PostgreSQL schema to ensure strict data isolation per tenant.
-   **UI/UX Design**: Features a dual monochromatic palette (dark with purple/violet, light with beige/golden/brown), animated orbs, glassmorphism, glow shadows, and modern components like animated counters, shimmer loaders, and page transitions.
-   **Performance Architecture**: Includes error boundaries, skeleton loaders, lazy loading for heavy libraries (XLSX, jsPDF, Recharts), a prefetch system for intelligent route preloading, and a virtual table for efficient large dataset rendering.
-   **State Management**: React Query is used for data fetching, caching, and synchronization, with structured query keys and cache invalidation.
-   **Key Features**:
    -   Automated Tiny ERP integration for orders and contacts.
    -   Robust cashback system with WhatsApp queue processing.
    -   Comprehensive sales management including goal tracking, bonus calculations, and goal redistribution.
    -   Multi-store support with granular configuration options.
    -   Subscription system with tiered access (Starter, Business, Enterprise) to features and limits.
    -   Time Clock System: REP-P compliant with digital signature PIN, change requests, and advanced reporting, adhering to Brazilian labor law (CLT and Portaria 671/2021).
    -   **Daily Tasks Module (Tarefas do Dia)**: Complete task management system with:
        -   **Architecture**: Tasks are RECURRING TEMPLATES (fixed weekly schedule), executions are separate historical records
        -   **Database Tables**:
            -   `daily_tasks` - Template table for recurring tasks (fixed weekday/time slots)
            -   `daily_task_executions` - Execution history tracking (who completed what when)
        -   Admin: Weekly calendar view (7 columns) with CRUD for recurring tasks by weekday
        -   Admin: Configure priority (Alta/Media/Baixa), due time, and shift assignment
        -   Admin: Per-store WhatsApp notification toggle (tasks_whatsapp_notificacoes_ativas)
        -   **Admin: History Tab** - Navigate by dates to view execution history (who did what when)
        -   Store: Timeline view with progress bar, checkboxes, and real-time updates via Supabase Realtime
        -   Visual indicators: color-coded priorities, overdue alerts, completion status with who/when
        -   Overdue notifications: In-app alerts for stores with pending tasks
        -   WhatsApp notifications: Backend service for auto-notification via Edge Function/cron
            -   Sender: Always uses GLOBAL WhatsApp number (not store's connected number)
            -   Recipient: Store's whatsapp field (phone number in stores table)
            -   Enable/disable: Per-store toggle in ModulesStoreConfig (tasks_whatsapp_notificacoes_ativas)
        -   **SQL Functions** (in `docs/tasks-executions-migration.sql`):
            -   `get_tasks_for_date(p_store_id, p_date)` - Gets tasks for a date with execution status
            -   `complete_task_execution(p_task_id, p_profile_id, p_notes, p_completion_date)` - Records execution
            -   `uncomplete_task_execution(p_task_id, p_profile_id, p_completion_date)` - Reverts execution
            -   `get_task_execution_history(p_store_id, p_start_date, p_end_date)` - Admin history view
            -   `get_task_statistics(p_store_id, p_date)` - Statistics for task progress
        -   Hooks: useDailyTasks, useTaskStatistics, useTasksRealtime
        -   Components: AdminTasksCalendarView, AdminTasksHistoryView, AdminDailyTasksConfig, LojaTasksTab, TaskOverdueNotification
        -   Migrations: docs/tasks-whatsapp-notification-migration.sql, docs/tasks-executions-migration.sql
        -   Database field: Uses `tasks_ativo` (consolidated, removed duplicate `tasks_module_enabled`)
    -   Store Task Alerts System: Allows admins to schedule recurring WhatsApp task reminders for stores.
    -   Daily Goal Check Module: Gamified system for collaborators to confirm daily goal viewing, with configurable bonuses and time limits.
    -   WhatsApp Global Fallback System: Ensures notifications can be sent from a global number if a store lacks its own connected WhatsApp credentials.
    -   **WhatsApp Campaigns Module**: Advanced mass messaging system with:
        -   Dual audience source: CRM filters OR custom spreadsheet import (primeiro_nome + telefone)
        -   AI-powered message variations via n8n webhook integration
        -   Risk monitoring matrix (LOW/MEDIUM/HIGH) based on sending rate and volume
        -   Phone number rotation with multiple strategies (EQUAL, PRIMARY_FIRST, RANDOM)
        -   4-step campaign wizard: Filter → Template → Schedule → Review
        -   Downloadable CSV/XLSX template for custom contact import
        -   Campaign lifecycle management (pause, resume, cancel)
    -   **EleveaOne Sites Module**: AI-powered one-page institutional website generator:
        -   7-step onboarding wizard: Business Type → Segment → Area → Details → Contact → Visual → Review
        -   30+ searchable business segments with contextual area selection
        -   Dual business type support: physical (with address/hours) or digital
        -   AI content generation via n8n webhook (X-APP-KEY authentication)
        -   Custom domain format: sitecliente.eleveaone.com.br
        -   One site per tenant with 30-day reset cooldown (cooldown applies to reset, not creation)
        -   Site status workflow: draft → generating → published → archived
        -   Netlify deployment integration with GitHub repository creation
        -   **HTML Template System**: Modern responsive templates with CSS variables for colors, dynamic sections for services/products, contact info, and business hours
        -   **Site Preview**: Real-time preview with desktop/mobile modes using secure iframe sandbox
        -   **HTML Export**: Download generated HTML for offline use or manual deployment
        -   **Image Upload System**: Dual-mode image handling:
            -   URL mode: Paste external image URLs (Google Drive, Imgur, etc)
            -   Upload mode: Drag & drop or click to upload local files (max 5MB, JPG/PNG/WebP/SVG)
            -   Images converted to Base64 and sent to n8n for GitHub upload
            -   Gallery support: Logo, hero image, and up to 4 gallery images
            -   Real-time preview with aspect ratio constraints
        -   **n8n Webhook Flow (3 etapas)**:
            1. `/elevea-sites/setup` - Cria repositório GitHub + projeto Netlify (~3s)
            2. `/elevea-sites/generate` - Gera conteúdo HTML com IA (~90s)
            3. `/ai/editsites` - Edita site já publicado via comandos de IA (~27-56s)
        -   **RESOLVIDO: Edição Cirúrgica** - Workflow n8n corrigido com node "Get a file" que busca HTML atual antes de editar. IA agora faz edições cirúrgicas (+208/-9 linhas) vs anteriores destrutivas (+99/-804). Sequência correta: Get File → Decode Base64 → Process HTML → List Files → Prepare Context → AI Agent → Commit.
        -   **Frontend Flow**:
            -   **Criação**: `createSite()` → `triggerDeploy()` → `generateContent()`
            -   **Edição**: `editSite()` (detecta automaticamente se site.status === 'published')
        -   **Asset Types**: Logo (1), Hero (1), Product (10), Ambient (5), Gallery (4) - com metadados específicos por tipo
        -   **Image Upload**: Suporte dual URL/Upload com Base64, validação de tipo/tamanho, preview em tempo real

## External Dependencies
-   **Supabase**: Core backend for database (PostgreSQL), authentication, and Edge Functions.
-   **Tiny ERP API**: Integrated for automated synchronization of orders and contacts.
-   **WhatsApp**: Used for cashback and task alert notifications, managed via an n8n webhook.
-   **Resend**: Utilized for sending email notifications (e.g., welcome emails, password resets).
-   **React Query**: Third-party library for data fetching and state management.
-   **XLSX, jsPDF, Recharts, html2canvas**: Libraries dynamically loaded for reporting and data visualization.
-   **Framer Motion**: Used for UI animations.

## Planned Modules

### Lista da Vez (Sales Queue Management)
Sistema de fila de prioridade de atendimento para vendedores no salao de vendas.

**Status**: Planejado - Documentacao completa em `docs/lista-da-vez-spec.md`

**Funcionalidades Principais**:
- Fila em tempo real por loja (Disponivel / Em Atendimento / Indisponivel)
- Check-in/out de turno + pausas configuráveis
- Iniciar/transferir/finalizar atendimento
- Registro de resultado (venda/perda) com motivos de perda
- Rankings, metas e campanhas de gamificacao
- Configuracao personalizada por loja (regras de fila, pausas, transferencias)

**Tabelas Supabase** (em `docs/lista-da-vez-migrations.sql`):
- `queue_sessions` - Sessoes de fila por dia/turno
- `queue_members` - Estado atual dos vendedores na fila
- `attendances` - Registro de atendimentos
- `attendance_outcomes` - Resultado de cada atendimento
- `loss_reasons` - Motivos de perda configuráveis
- `queue_events` - Log de auditoria
- `queue_store_settings` - Configuracoes por loja

**KPIs**:
- Taxa de conversao (vendas/atendimentos)
- Tempo medio de atendimento
- Motivos de perda (ranking)
- Participacao de atendimentos/receita por vendedor