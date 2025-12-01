# Sistema de Retiradas - Multi-tenant ERP/Sales Management

## Overview
Complete multi-tenant ERP/sales management SaaS system migrated from Lovable to Replit. Features subscription-based licensing, Tiny ERP integration, cashback system with WhatsApp notifications, sales tracking, goals, bonuses, and comprehensive reporting.

## Project Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **External Services**: Tiny ERP API, WhatsApp notifications (n8n webhook)
- **Multi-tenancy**: RLS-based data isolation using `sistemaretiradas` schema

## Recent Changes
- **2024-12-01**: Project migrated from Lovable to Replit environment
- Configured Vite server to bind to 0.0.0.0:5000 for Replit compatibility
- Set up "Start application" workflow

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
