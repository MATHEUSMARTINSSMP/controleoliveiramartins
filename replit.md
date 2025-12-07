# Sistema de Retiradas - Multi-tenant ERP/Sales Management

## Overview
Complete multi-tenant ERP/sales management SaaS system migrated from Lovable to Replit. Features subscription-based licensing, Tiny ERP integration, cashback system with WhatsApp notifications, sales tracking, goals, bonuses, and comprehensive reporting.

## Project Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **External Services**: Tiny ERP API, WhatsApp notifications (n8n webhook)
- **Multi-tenancy**: RLS-based data isolation using `sistemaretiradas` schema

## Recent Changes
- **2024-12-07**: WhatsApp Integration Stabilization & Frontend Refetch Optimization:
  - **Frontend Loop Fixed**: Removed automatic `fetchStoresAndCredentials()` after save/test operations
  - **Optimized Updates**: Local state updates instead of full refetch - prevents excessive re-renders
  - **useEffect Fixed**: Changed dependency from `[profile]` to `[profile?.id]` - avoids unnecessary reloads
  - **N8N Query Corrected**: Fixed schema from `elevea` to `sistemaretiradas` in PostgreSQL save credentials query
  - **Connection Event Flow**: Connection events now skip Chatwoot and only save credentials (prevents webhook loop)
  - **File Created**: `N8N_QUERY_SAVE_CREDENTIALS.sql` with correct schema and field mapping
  - **Loop Prevention Guide**: `PARAR_LOOP_N8N.md` for webhook deduplication
  - **Component Updated**: `src/components/admin/WhatsAppStoreConfig.tsx` with optimized state management
- **2024-12-07**: Critical Bug Fixes - Tiny ERP Sales Sync:
  - **Bug Fixed**: `qtd_itens` field was NOT being saved in `prepararDadosPedidoCompleto` function
  - This caused `sales_qtd_pecas_check` constraint violations when creating sales
  - **Solution**: Added `qtd_itens` calculation from `itensComCategorias` array
  - **New Column**: Added `tiny_contact_id` to `sales` table for better traceability
  - **Function Updated**: `criar_vendas_de_tiny_orders` now uses `qtd_itens` column and includes `tiny_contact_id`
  - **Mapping**: `tiny_orders.cliente_id` maps to `sales.tiny_contact_id`
  - **SQL Files Created**: `ADICIONAR_TINY_CONTACT_ID.sql`, `ATUALIZAR_FUNCAO_COM_CONTACT_ID.sql`
- **2024-12-05**: Phase 5 - DUAL MONOCHROMATIC PALETTES with Animated Orbs:
  - **Design Philosophy**: Two distinct monochromatic palettes per theme
  - **Dark Theme**: Purple/Violet monocromatic palette (262deg hue) with subtle animated orbs
    - Background: 262 20% 4% (deep purple-black)
    - Cards/inputs: 262 18% 8% to 262 15% 16%
    - Primary: 262 60% 65% (muted violet)
    - Animated orbs: violet-500/20, purple-500/18, indigo-500/15
  - **Light Theme**: Beige/Golden/Brown monocromatic palette (35-40deg hue)
    - Background: 40 30% 96%
    - Cards: 40 40% 97%
    - Primary: 38 92% 50% (golden)
    - Animated orbs: amber-500/15, orange-400/12, yellow-500/10
  - **Animated Orbs Component**: `src/components/ui/animated-orbs.tsx`
    - Floating blur orbs with framer-motion animations
    - Different speeds (15s, 18s, 20s, 22s) for organic feel
    - Applied to all pages: Auth, Admin, Loja, Colaboradora dashboards
  - **Auth Page Enhanced**: Purple gradient icon, violet button, animated background orbs
  - **Result**: Elegant, chic, minimalist, futuristic - subtle colors within each theme family
- **2024-12-05**: Theme System + Auth Modernization:
  - **Theme System**: ThemeProvider with dark/light toggle, localStorage persistence (dark as default)
  - **Auth.tsx Fully Theme-Aware**: All colors replaced with semantic tokens
  - **LojaDashboard Modularization**: 5 reusable components in `src/components/loja/`:
    - `types.ts`: Shared TypeScript interfaces
    - `StoreMetricsCards.tsx`: Store performance metrics
    - `ColaboradoraPerformanceCards.tsx`: Collaborator performance cards
    - `RankingDisplay.tsx`: Sales ranking display
    - `WeeklyHistoryChart.tsx`: 7-day history chart
- **2024-12-05**: Phase 3 UI/UX Modernization - Futuristic Design System:
  - **New Design Tokens**: Violet/purple gradient palette, glassmorphism variables, glow shadows
  - **Modern UI Components**:
    - `glass-card.tsx`: Glassmorphism cards with framer-motion animations
    - `animated-counter.tsx`: Animated number counting with currency support
    - `gradient-background.tsx`: Animated backgrounds with floating orbs
    - `shimmer-loader.tsx`: Modern skeleton loaders with shimmer effects
    - `modern-stat-card.tsx`: Stat cards with progress tracking
    - `page-transition.tsx`: Page transition animations (FadeIn, SlideIn, StaggerContainer)
    - `modern-dashboard-layout.tsx`: Dashboard wrapper with header and sections
    - `metric-hero-card.tsx`: Hero metric cards with trends and progress
    - `celebration-effects.tsx`: Confetti, sparkles, pulse rings, success checkmarks
  - **Modernized Pages**: Auth.tsx and Index.tsx with smooth animations and glassmorphism
  - **Utility Classes**: `.glass`, `.glass-card`, `.gradient-text`, `.glow`, `.hover-lift`
- **2024-12-05**: Enterprise Architecture Phase 2 - Dashboard Cleanup:
  - **ColaboradoraDashboard**: Removed ~200 lines of duplicate fetch functions, migrated to React Query hooks
  - **AdminDashboard**: Migrated to useAdminPendingAdiantamentos hook, removed manual fetch/polling
  - **LojaDashboard**: Removed 8 wrapper functions (~60 lines), kept core WithStoreId functions
  - **New Hooks Created**: 
    - `use-loja.ts`: Store metrics, 7-day history, goals, rankings, benchmarks, collaborator performance
    - `use-admin.ts`: Pending adiantamentos with 30s refetch
  - All dashboards now use centralized React Query hooks from `src/hooks/queries/`
- **2024-12-04**: Phase 1 Enterprise Modernization completed:
  - Error Boundaries with page/section/component levels
  - Skeleton loaders for all dashboards
  - Lazy loading for heavy libraries (XLSX, jsPDF, Recharts, html2canvas)
  - Code splitting reduced bundle from ~2.5MB to ~150KB main
  - Prefetch system for intelligent route preloading
  - Loading states with async action hooks
- **2024-12-01**: Project migrated from Lovable to Replit environment
- Configured Vite server to bind to 0.0.0.0:5000 for Replit compatibility
- Set up "Start application" workflow

## Performance Architecture
- **Error Boundaries**: `src/components/ui/error-boundary.tsx` - Page, section, component levels with retry functionality
- **Skeleton Loaders**: `src/components/ui/skeleton-loaders.tsx` - Dashboard-specific loading states
- **Lazy Imports**: `src/lib/lazy-imports.ts` - Dynamic imports for XLSX, jsPDF with caching
- **Lazy Charts**: `src/components/ui/lazy-chart.tsx` - Recharts components with Suspense
- **Prefetch System**: `src/lib/prefetch.ts` - Route-based intelligent preloading
- **Loading States**: `src/hooks/use-async-action.ts` - Async action management with toasts
- **Virtual Table**: `src/components/ui/virtual-table.tsx` - Efficient rendering for large datasets
- **All routes use lazy() with Suspense boundaries in App.tsx**

## React Query Hooks Architecture
Located in `src/hooks/queries/`:
- **Types**: `types.ts` - Shared TypeScript interfaces for all entities
- **Base Utilities**: `use-supabase-query.ts` - Query helpers and cache utilities
- **Stores**: `use-stores.ts` - Store queries and settings
- **Profiles**: `use-profiles.ts` - User profile queries and mutations
- **Colaboradora**: `use-colaboradora.ts` - Dashboard data, KPIs, purchases, parcelas
- **Sales**: `use-sales.ts` - Sales queries, stats, ranking, mutations
- **Bonuses**: `use-bonuses.ts` - Bonus/goals queries with progress tracking

### Query Keys Convention
All query keys follow the pattern: `[QUERY_KEY, filters/params]`
- `['profiles', { role, storeId, activeOnly }]`
- `['sales', { storeId, colaboradoraId, dateRange }]`
- `['bonuses', 'active', storeId]`

### Cache Strategy
- `staleTime`: 1-5 minutes depending on data volatility
- `gcTime`: 5 minutes for garbage collection
- Auto-invalidation on mutations

## Database Schema
- **Schema**: `sistemaretiradas` (all tables use this schema)
- **Key Tables**:
  - `stores`: Multi-store management with subscription plans
  - `profiles`: User profiles with roles (ADMIN, COLABORADORA, LOJA)
  - `sales`: Sales tracking with bonus calculations
  - `bonuses`: Monthly bonus periods and calculations
  - `cashback_*`: Cashback system (transactions, balance, settings, queue)
  - `tiny_orders`, `tiny_contacts`: Synced data from Tiny ERP
  - `subscription_*`: Subscription management and limits

## Subscription System
- **Starter**: 1 store, 5 collaborators, basic features
- **Business**: 3 stores, 25 collaborators, advanced features
- **Enterprise**: 7 stores, 80 collaborators, all features

## Key Features
1. **Tiny ERP Integration**: Automated order/contact sync with polling optimization
2. **Cashback System**: Automatic cashback generation with WhatsApp queue processing
3. **Sales Management**: Goal tracking, bonus calculations, performance reports
4. **Multi-store Support**: Store-specific settings and data isolation
5. **Real-time Sync**: PostgreSQL pg_cron jobs for scheduled synchronization

## Supabase Edge Functions
Located in `supabase/functions/`:
- `sync-tiny-orders`: Sync orders from Tiny ERP (incremental + full sync)
- `process-cashback-queue`: Process WhatsApp cashback notifications queue
- `create-colaboradora`: Create new collaborator accounts
- `create-dev-user`: Development user creation utility
- `reset-colaboradora-password`: Password reset for collaborators
- `request-password-reset`: Password recovery flow
- `send-welcome-email`: Welcome email for new users
- `send-password-reset-email`: Password reset email notifications
- `seed-users`: Database seeding utility

## Environment Variables
Required Supabase secrets (configured in Supabase dashboard):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL` (PostgreSQL connection string)
- `RESEND_API_KEY` (for email notifications)

Frontend environment variables (create `.env` file):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## User Preferences
- Keep code clean and well-organized
- Follow existing patterns for multi-tenancy and RLS
- Maintain security with proper role-based access
- Use TypeScript for type safety
- Follow React best practices with hooks and functional components

## Running the Project
```bash
npm install
npm run dev
```
The application will run on http://localhost:5000

## Development Notes
- All database operations use the `sistemaretiradas` schema
- RLS policies enforce multi-tenant data isolation
- Sync jobs run via pg_cron (every 1 minute incremental, various full syncs)
- Cashback WhatsApp uses queue to avoid blocking operations
- Phone normalization handles Brazilian format (55 + DDD + number)
