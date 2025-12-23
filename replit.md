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

## External Dependencies
-   **Supabase**: Core backend for database (PostgreSQL), authentication, and Edge Functions.
-   **Tiny ERP API**: Integrated for automated synchronization of orders and contacts.
-   **WhatsApp**: Used for cashback and task alert notifications, managed via an n8n webhook.
-   **Resend**: Utilized for sending email notifications (e.g., welcome emails, password resets).
-   **React Query**: Third-party library for data fetching and state management.
-   **XLSX, jsPDF, Recharts, html2canvas**: Libraries dynamically loaded for reporting and data visualization.
-   **Framer Motion**: Used for UI animations.