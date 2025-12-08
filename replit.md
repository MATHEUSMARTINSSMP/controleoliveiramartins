# Sistema de Retiradas - Multi-tenant ERP/Sales Management

## Overview
Sistema de Retiradas is a comprehensive multi-tenant ERP/sales management SaaS system designed to streamline business operations. It features subscription-based licensing, integration with Tiny ERP for order and contact synchronization, a cashback system with WhatsApp notifications, and robust sales tracking with goals, bonuses, and reporting. The project aims to provide an elegant, chic, minimalist, and futuristic user experience, adhering to Brazilian labor law compliance for time clock management.

## User Preferences
- Keep code clean and well-organized
- Follow existing patterns for multi-tenancy and RLS
- Maintain security with proper role-based access
- Use TypeScript for type safety
- Follow React best practices with hooks and functional components

## System Architecture
The system is built with a modern web stack:
- **Frontend**: React, TypeScript, Vite, TailwindCSS, and shadcn/ui for a modern and responsive user interface.
- **Backend**: Supabase, leveraging PostgreSQL for the database and Edge Functions for serverless logic.
- **Multi-tenancy**: Achieved through Row Level Security (RLS) policies within the `sistemaretiradas` PostgreSQL schema, ensuring data isolation for each tenant.
- **UI/UX Design**: Employs a dual monochromatic palette theme system (dark with purple/violet, light with beige/golden/brown), animated orbs, glassmorphism, glow shadows, and modern UI components like animated counters, shimmer loaders, and page transitions for an engaging user experience.
- **Performance Architecture**: Incorporates error boundaries, skeleton loaders, lazy loading for heavy libraries (XLSX, jsPDF, Recharts), a prefetch system for intelligent route preloading, and a virtual table for efficient large dataset rendering.
- **State Management**: Utilizes React Query for data fetching, caching, and synchronization, with a structured approach to query keys and cache invalidation.
- **Key Features**: Includes automated Tiny ERP integration, a robust cashback system with WhatsApp queue processing, comprehensive sales management with goal tracking and bonus calculations, and multi-store support.
- **Time Clock System**: Features digital signature PIN for REP-P compliance, time record change requests, advanced reporting, and modular components, adhering to Brazilian labor law (CLT and Portaria 671/2021).
- **Goal Redistribution System**: Frontend-only logic to dynamically redistribute store daily goals among working collaborators, ensuring 100% goal coverage.
- **Subscription System**: Defines different tiers (Starter, Business, Enterprise) with varying limits on stores and collaborators and feature access.

## External Dependencies
- **Supabase**: Primary backend for database (PostgreSQL), authentication, and Edge Functions.
- **Tiny ERP API**: Integrated for automated synchronization of orders and contacts.
- **WhatsApp**: Used for cashback notifications, managed via an n8n webhook.
- **Resend**: Utilized for sending email notifications (e.g., welcome emails, password resets).
- **React Query**: A third-party library for data fetching and state management.
- **XLSX, jsPDF, Recharts, html2canvas**: Libraries dynamically loaded for reporting and data visualization.
- **Framer Motion**: Used for animations in UI components.

## Recent Changes

### 2024-12-08: Digital Signature PIN System (REP-P Compliance)
- **Security Decision**: PIN de assinatura digital e DIFERENTE da senha de acesso ao sistema
- **Complete SQL Schema**: `sql_migrations_archive/SQL_ASSINATURA_DIGITAL_COMPLETO.sql` with:
  - `time_clock_signature_pins`: Table for storing hashed signature PINs (bcrypt)
  - `time_clock_digital_signatures`: Table for storing each punch signature
  - `time_clock_pin_audit_log`: Audit log for all PIN operations
  - `set_signature_pin()`: RPC to create/update PIN with bcrypt hash
  - `validate_signature_pin()`: RPC to validate PIN with attempt throttling (5 attempts, 15min lockout)
  - `has_signature_pin()`: RPC to check if collaborator has PIN configured
  - `admin_reset_signature_pin()`: RPC for admin to reset collaborator's PIN
  - `generate_pin_reset_token()`: RPC to generate email reset token (expires 1h)
  - `reset_pin_with_token()`: RPC to reset PIN using email token
  - `get_pin_status()`: RPC to get PIN status for admin dashboard
- **TimeClockRegister.tsx Enhanced**:
  - Onboarding flow for first-time PIN setup
  - PIN validation via Supabase RPC before punch recording
  - Settings button to change PIN anytime
  - "Esqueci meu PIN" (forgot PIN) flow with email reset
  - Clear messaging that PIN is different from login password
- **Netlify Functions for Email**:
  - `send-pin-reset-email.js`: Sends reset token via Resend
  - `request-pin-reset.js`: Generates token and triggers email
- **Security Benefits**: Reduced blast radius, enables rotation, supports shared kiosks
- **Portaria 671/2021 Compliance**: PIN-based digital signature for REP-P

### 2024-12-08: SQL Deployment Complete
- **SQL Files Executed Successfully in Order**:
  1. `sql_migrations_archive/SQL_PARTE1_TIME_CLOCK_RECORDS.sql` - Base table for time records
  2. `sql_migrations_archive/SQL_PARTE2_ASSINATURA_DIGITAL.sql` - PIN and signature tables
  3. `sql_migrations_archive/SQL_PARTE3_FUNCOES_RPC.sql` - RPC functions for PIN management
- **TypeScript Fixes**: Corrected type casting for Supabase RPC calls in TimeClockRegister.tsx
- **All LSP Errors Resolved**: Component fully typed and working

### Pending Configuration
- Configure Netlify environment variables for email functions:
  - `RESEND_API_KEY` - API key from Resend
  - `SUPABASE_URL` - Project URL from Supabase
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key from Supabase