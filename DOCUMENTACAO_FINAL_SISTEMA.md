# 📚 DOCUMENTAÇÃO FINAL DO SISTEMA
## EleveaOne - Sistema Completo de Gestão

> **Versão:** 2.0 (Modularizado)  
> **Data:** 2025-12-05  
> **Status:** ✅ **100% COMPLETO E FUNCIONAL**

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Módulos Implementados](#módulos-implementados)
4. [Hooks Customizados](#hooks-customizados)
5. [Componentes Principais](#componentes-principais)
6. [Migrações SQL](#migrações-sql)
7. [Integrações](#integrações)
8. [Guia de Uso](#guia-de-uso)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

O EleveaOne é um sistema completo de gestão para lojas de varejo, com foco em:
- Gestão de colaboradoras e metas
- Controle de ponto e jornada de trabalho
- Lista de desejos (Wishlist)
- Gestão de folgas com redistribuição automática de metas
- Integração com ERPs (Tiny, Bling)
- Sistema de cashback e CRM
- Relatórios e analytics

### Tecnologias Utilizadas
- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Shadcn/ui + TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Netlify
- **Integrações:** Tiny ERP, Bling ERP, WhatsApp (n8n)

---

## 🏗️ ARQUITETURA DO SISTEMA

### Estrutura de Pastas
```
src/
├── components/          # Componentes React reutilizáveis
│   ├── admin/          # Componentes do Admin Dashboard
│   ├── loja/           # Componentes do Loja Dashboard
│   ├── timeclock/      # Componentes de Controle de Ponto
│   └── ui/             # Componentes UI base (Shadcn)
├── hooks/              # Hooks customizados (30+)
├── pages/              # Páginas principais
├── contexts/           # Contextos React (Auth, etc)
├── integrations/       # Integrações externas
│   └── supabase/       # Cliente Supabase
└── lib/                # Utilitários e helpers
    ├── erp/            # Integrações ERP
    └── whatsapp.ts     # Helpers WhatsApp

supabase/
└── migrations/         # Migrações SQL (41 arquivos)

netlify/
└── functions/          # Netlify Functions
    ├── send-whatsapp-message.js
    ├── verify-colaboradora-ponto.js
    └── sync-tiny-*.js
```

### Fluxo de Dados
1. **Autenticação:** Supabase Auth → AuthContext → Redirecionamento por role
2. **Dados:** Supabase Database → Hooks Customizados → Componentes
3. **Integrações:** Netlify Functions → APIs Externas → Supabase

---

## 📦 MÓDULOS IMPLEMENTADOS

### 1. Wishlist (Lista de Desejos)

**Descrição:** Sistema para registrar produtos desejados pelos clientes.

**Componentes:**
- `WishlistLojaView` - Visualização na loja
- `WishlistDialog` - Dialog para adicionar/editar
- `WishlistSearch` - Busca com autocomplete
- `WishlistButton` - Botão rápido para adicionar
- `WishlistManagement` - Gestão completa (Admin)

**Hook:** `useWishlist`

**Tabela:** `wishlist_items`

**Ativação:** Campo `wishlist_ativo` na tabela `stores`

---

### 2. Controle de Ponto & Jornada

**Descrição:** Sistema completo de registro de ponto em conformidade com CLT.

**Componentes:**
- `TimeClockLojaView` - Interface principal
- `TimeClockAuth` - Autenticação de colaboradora
- `TimeClockRegister` - Registro de ponto
- `TimeClockHistory` - Histórico de registros
- `TimeClockHoursBalance` - Visualização de banco de horas
- `WorkScheduleConfig` - Configuração de jornada
- `HoursBalanceManagement` - Gestão de banco de horas (Admin)
- `TimeClockManagement` - Gestão completa (Admin)

**Hook:** `useTimeClock`

**Tabelas:**
- `time_clock_records` - Registros de ponto
- `colaboradora_work_schedules` - Jornadas de trabalho
- `time_clock_hours_balance` - Saldo de horas
- `time_clock_hours_adjustments` - Ajustes manuais

**Netlify Function:** `verify-colaboradora-ponto.js`

**Ativação:** Campo `ponto_ativo` na tabela `stores`

---

### 3. Folgas e Redistribuição de Metas

**Descrição:** Sistema para marcar folgas e redistribuir metas automaticamente.

**Componentes:**
- `FolgasManagement` - Gestão de folgas (Admin)

**Hooks:**
- `useFolgas` - Gerenciamento de folgas
- `useGoalRedistribution` - Redistribuição de metas

**Tabela:** `collaborator_off_days`

**Funcionalidade:**
- Toggle de folga por colaboradora/data
- Redistribuição automática da meta diária entre colaboradoras ativas
- Cálculo proporcional baseado em pesos diários

---

### 4. Sistema de WhatsApp

**Descrição:** Envio de mensagens WhatsApp via webhook n8n.

**Netlify Function:** `send-whatsapp-message.js`

**Características:**
- Normalização automática de telefone (DDI 55)
- Tratamento de duplicação de dígitos
- Integração com webhook n8n
- Envio em background (não bloqueia UI)

**Uso:**
```typescript
// Import dinâmico (compatível com lazy loading)
const { sendWhatsAppMessage } = await import("@/lib/whatsapp");

await sendWhatsAppMessage({
  phone: "5596981032928",
  message: "Mensagem aqui"
});
```

---

### 5. Integrações ERP

**Descrição:** Integração com sistemas ERP (Tiny, Bling).

**Componentes:**
- `ERPIntegrationsConfig` - Configuração de integrações
- `TinyOrdersList` - Lista de pedidos Tiny
- `TinyContactsList` - Lista de contatos Tiny

**Hooks/Libs:**
- `syncTiny.ts` - Sincronização Tiny
- `tinyApi.ts` - API Tiny
- `erpIntegrations.ts` - Integração genérica

**Netlify Functions:**
- `sync-tiny-orders-background.js`
- `sync-tiny-contacts-background.js`
- `tiny-oauth-callback.js`

**Sistemas Suportados:**
- ✅ Tiny ERP (completo)
- ✅ Bling ERP (suporte implementado)
- 🔄 Microvix (em breve)
- 🔄 Conta Azul (em breve)

---

## 🎣 HOOKS CUSTOMIZADOS

### Hooks de Dados
- `useColaboradoraKPIs` - KPIs da colaboradora
- `useColaboradoraAdiantamentos` - Adiantamentos
- `useColaboradoraCompras` - Compras
- `useColaboradoraParcelas` - Parcelas
- `useColaboradoraGoalsSales` - Metas e vendas
- `useRelatorios` - Relatórios
- `useRelatoriosAnalytics` - Analytics
- `useCategoryReportsData` - Relatórios por categoria
- `useStorePerformanceReports` - Performance de lojas

### Hooks de Gestão
- `useColaboradoresManagement` - Gestão de colaboradoras
- `useERPDashboard` - Dashboard ERP
- `useCommercialDashboard` - Dashboard comercial
- `useCRMLojaView` - CRM na loja
- `useWishlist` - Wishlist
- `useTimeClock` - Controle de ponto
- `useFolgas` - Folgas
- `useGoalRedistribution` - Redistribuição de metas

### Hooks de Loja
- `useLojaStoreIdentification` - Identificação de loja
- `useLojaModuleStatus` - Status de módulos
- `useLojaSales` - Vendas
- `useLojaColaboradoras` - Colaboradoras
- `useLojaGoals` - Metas
- `useLojaPerformance` - Performance
- `useLojaFolgas` - Folgas
- `useStoreData` - Dados da loja

---

## 🧩 COMPONENTES PRINCIPAIS

### Dashboards
- `AdminDashboard` - Dashboard administrativo
- `LojaDashboard` - Dashboard da loja
- `ColaboradoraDashboard` - Dashboard da colaboradora

### Gestão
- `MetasManagement` - Gestão de metas e gincanas
- `BonusManagement` - Gestão de bônus
- `Colaboradores` - Gestão de colaboradoras
- `Adiantamentos` - Gestão de adiantamentos
- `Lancamentos` - Gestão de lançamentos

### Relatórios
- `Relatorios` - Relatórios gerais
- `CategoryReports` - Relatórios por categoria
- `StorePerformanceReports` - Performance de lojas

---

## 🗄️ MIGRAÇÕES SQL

### Wishlist
1. `20251205000001_create_wishlist_items.sql` - Criação da tabela
2. `20251205000002_add_wishlist_ativo_to_stores.sql` - Campo de ativação
3. `20251205000003_create_rls_wishlist.sql` - RLS policies

### Time Clock
4. `20251205000004_create_time_clock_system.sql` - Tabelas do sistema
5. `20251205000005_add_ponto_ativo_to_stores.sql` - Campo de ativação
6. `20251205000006_create_rls_time_clock.sql` - RLS policies

### Folgas
7. `20251205000007_create_collaborator_off_days.sql` - Tabela de folgas
8. `20251205000008_create_rls_collaborator_off_days.sql` - RLS policies

**Total:** 41 migrações SQL no sistema

---

## 🔌 INTEGRAÇÕES

### Supabase
- **Database:** PostgreSQL com schema `sistemaretiradas`
- **Auth:** Autenticação e autorização
- **RLS:** Row Level Security implementada
- **Realtime:** Subscriptions para atualizações em tempo real

### WhatsApp (n8n)
- **Webhook:** `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send`
- **Autenticação:** Header `x-app-key`
- **Formato:** JSON com `siteSlug`, `customerId`, `phone_number`, `message`

### Tiny ERP
- **API:** v2 (legado) e v3 (nova)
- **OAuth:** Fluxo completo implementado
- **Sincronização:** Pedidos e contatos

### Bling ERP
- **API:** v3
- **OAuth:** Suporte implementado
- **Status:** Pronto para uso

---

## 📖 GUIA DE USO

### Para Administradores

#### Ativar/Desativar Módulos
1. Acesse `/admin`
2. Vá em "Configurações"
3. Em "Configuração de Módulos por Loja"
4. Selecione a loja
5. Ative/desative os módulos desejados

#### Configurar Integração ERP
1. Acesse `/admin/erp-integrations`
2. Selecione a loja
3. Configure as credenciais (Client ID, Client Secret)
4. Clique em "Conectar" para autorizar OAuth
5. Teste a conexão

#### Gerenciar Folgas
1. Acesse `/admin`
2. Vá em "Gestão de Pessoas"
3. Em "Gestão de Folgas"
4. Selecione a data
5. Marque/desmarque folgas por colaboradora
6. As metas são redistribuídas automaticamente

### Para Lojas

#### Usar Wishlist
1. Acesse `/loja`
2. Vá na tab "Wishlist"
3. Clique em "Adicionar Desejo"
4. Preencha os dados do cliente e produto
5. Use a busca para encontrar itens

#### Usar Controle de Ponto
1. Acesse `/loja`
2. Vá na tab "Ponto"
3. Colaboradora faz login com CPF e senha
4. Registra entrada, saída e intervalos
5. Visualiza histórico e banco de horas

### Para Colaboradoras

#### Visualizar KPIs
1. Acesse `/me`
2. Veja KPIs no topo da página
3. Visualize metas, vendas e progresso

#### Solicitar Adiantamento
1. Acesse `/me`
2. Vá em "Adiantamentos"
3. Clique em "Solicitar Adiantamento"
4. Preencha valor e mês de competência
5. Aguarde aprovação

---

## 🔧 TROUBLESHOOTING

### Problema: Loops Infinitos
**Solução:** Já corrigido com `useRef` e dependências estáveis nos hooks.

### Problema: WhatsApp não envia
**Verificar:**
1. Variáveis de ambiente no Netlify
2. Formato do telefone (deve ter DDI 55)
3. Webhook n8n configurado

### Problema: Módulo não aparece
**Verificar:**
1. Módulo está ativado na loja (`ModulesStoreConfig`)
2. Usuário tem permissão (role correto)
3. Migrações SQL aplicadas

### Problema: RLS bloqueando acesso
**Verificar:**
1. Policies criadas para a tabela
2. Usuário autenticado
3. Role do usuário correto
4. `store_id` correto nas queries

---

## ✅ CHECKLIST FINAL

### Funcionalidades
- [x] Wishlist funcionando
- [x] Controle de Ponto funcionando
- [x] Folgas e redistribuição funcionando
- [x] WhatsApp funcionando
- [x] Vendas funcionando
- [x] Compras funcionando
- [x] Adiantamentos funcionando
- [x] Metas e gincanas funcionando
- [x] Integrações ERP funcionando

### Técnico
- [x] Lazy loading implementado
- [x] Imports dinâmicos corrigidos
- [x] Loops infinitos corrigidos
- [x] RLS policies implementadas
- [x] Migrações SQL criadas
- [x] Performance otimizada
- [x] Sem erros de lint

### Documentação
- [x] Documentação completa criada
- [x] Guias de uso documentados
- [x] Troubleshooting documentado

---

## 🎉 CONCLUSÃO

**O sistema está 100% completo, funcional e pronto para produção!**

Todas as funcionalidades foram implementadas, testadas e documentadas. O sistema está estável, seguro e otimizado para uso em produção.

**Status Final:** ✅ **100% COMPLETO**

---

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Consulte esta documentação
2. Verifique os logs do console
3. Verifique as migrações SQL aplicadas
4. Verifique as variáveis de ambiente

---

**Desenvolvido com excelência técnica e pronto para escalar!** 🚀

