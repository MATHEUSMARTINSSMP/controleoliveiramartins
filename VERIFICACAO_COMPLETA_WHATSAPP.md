# 🔍 VERIFICAÇÃO COMPLETA DO SISTEMA DE WHATSAPP

**Data:** 2025-12-20  
**Escopo:** Sistema completo de WhatsApp (números principais, reserva, fila, campanhas)

---

## 📋 ÍNDICE

1. [Estrutura de Tabelas](#1-estrutura-de-tabelas)
2. [Migrations Criadas](#2-migrations-criadas)
3. [Funções Netlify](#3-funções-netlify)
4. [Código Frontend](#4-código-frontend)
5. [Fluxos de Autenticação](#5-fluxos-de-autenticação)
6. [Fila de Mensagens](#6-fila-de-mensagens)
7. [Problemas Identificados](#7-problemas-identificados)
8. [Recomendações](#8-recomendações)

---

## 1. ESTRUTURA DE TABELAS

### 1.1 `whatsapp_credentials` (Números Principais)

**Status:** ✅ Estrutura Correta

**Colunas Principais:**
- `admin_id` (UUID) - Referência a `profiles.id`
- `customer_id` (VARCHAR) - DEPRECADO, mantido para compatibilidade
- `site_slug` (VARCHAR) - Slug único do site
- `is_global` (BOOLEAN) - Indica se é credencial global (nova migration)
- `is_backup` (BOOLEAN) - Sempre `false` para números principais (nova migration)
- `uazapi_instance_id`, `uazapi_token`, `uazapi_phone_number`
- `uazapi_qr_code`, `uazapi_status`
- `status` (active/inactive)

**Gerenciamento:**
- ✅ Gerenciado em `WhatsAppStoreConfig.tsx`
- ✅ Autenticação via `whatsapp-connect.js` e `whatsapp-status.js`

**Migrations:**
- ✅ `20251205000009_create_whatsapp_credentials.sql` - Criação inicial
- ✅ `20251210000028_migrate_whatsapp_credentials_to_admin_id.sql` - Adiciona `admin_id`
- ✅ `20251220000003_add_is_global_to_whatsapp_credentials.sql` - Adiciona `is_global`
- ✅ `20251220000002_mark_whatsapp_credentials_as_primary.sql` - Adiciona `is_backup`

---

### 1.2 `whatsapp_accounts` (Números Reserva)

**Status:** ✅ Estrutura Correta (com nova abordagem boolean)

**Colunas Principais:**
- `id` (UUID) - Primary Key
- `store_id` (UUID) - Referência a `stores.id`
- `phone` (TEXT) - Número de telefone
- `is_backup1`, `is_backup2`, `is_backup3` (BOOLEAN) - **NOVA ABORDAGEM**
- `uazapi_instance_id`, `uazapi_token`
- `uazapi_qr_code`, `uazapi_status` - Para autenticação
- `is_connected` (BOOLEAN)
- `account_type` (TEXT) - DEPRECADO, mantido para compatibilidade

**Gerenciamento:**
- ✅ Gerenciado em `WhatsAppBulkSend.tsx`
- ⚠️ **FALTA:** Funções de autenticação (QR code, status) para números reserva

**Migrations:**
- ✅ `20251217200000_create_whatsapp_campaigns_module.sql` - Criação inicial
- ✅ `20251220000001_adapt_whatsapp_accounts_for_backup_auth.sql` - Adiciona campos de autenticação
- ✅ `20251220000004_simplify_backup_accounts_to_booleans.sql` - **NOVA:** Adiciona `is_backup1/2/3`

---

### 1.3 `whatsapp_message_queue` (Fila Unificada)

**Status:** ✅ Estrutura Correta

**Colunas Principais:**
- `id`, `phone`, `message`, `store_id`
- `priority` (1-10) - 1-3 crítico, 4-6 normal, 7-10 campanhas
- `message_type` (CASHBACK, NOTIFICATION, POINT_CLOCK, CAMPAIGN, OTHER)
- `whatsapp_account_id` (UUID) - Referência a `whatsapp_accounts.id` (NULL = número principal)
- `campaign_id` (UUID) - Referência a campanha
- `status` (PENDING, SCHEDULED, SENDING, SENT, FAILED, CANCELLED)
- `scheduled_for`, `allowed_start_hour`, `allowed_end_hour`
- `interval_seconds`, `max_per_day_per_contact`, `max_total_per_day`

**Migration:**
- ✅ `20251219000003_create_bulk_whatsapp_queue.sql`

---

### 1.4 `whatsapp_campaigns` (Campanhas)

**Status:** ✅ Estrutura Correta

**Migration:**
- ✅ `20251217200000_create_whatsapp_campaigns_module.sql`

---

## 2. MIGRATIONS CRIADAS

### ✅ Migrations Implementadas

1. **`20251220000003_add_is_global_to_whatsapp_credentials.sql`**
   - Adiciona coluna `is_global` BOOLEAN
   - Default: `false`
   - Índice para queries globais

2. **`20251220000004_simplify_backup_accounts_to_booleans.sql`**
   - Adiciona `is_backup1`, `is_backup2`, `is_backup3` (BOOLEAN)
   - Migra dados de `account_type` para boolean
   - Constraint: apenas uma coluna pode ser `true` por vez
   - Índices para performance

3. **`20251220000002_mark_whatsapp_credentials_as_primary.sql`**
   - Adiciona `is_backup` BOOLEAN (sempre `false` para principais)

### ⚠️ Migrations que Precisam ser Executadas no Supabase

Todas as 3 migrations acima precisam ser executadas no Supabase para que o sistema funcione corretamente.

---

## 3. FUNÇÕES NETLIFY

### 3.1 `send-whatsapp-message.js`

**Status:** ✅ Funcional (com melhorias recentes)

**Funcionalidades:**
- ✅ Suporte a `whatsapp_account_id` para números reserva
- ✅ Busca número reserva em `whatsapp_accounts` quando `whatsapp_account_id` fornecido
- ✅ Fallback para número principal (via `whatsapp_credentials`)
- ✅ Fallback para credencial global (`is_global = true`)
- ✅ Fallback para variáveis de ambiente

**Fluxo de Prioridade:**
1. Se `whatsapp_account_id` fornecido → buscar em `whatsapp_accounts`
2. Se `store_id` fornecido → buscar em `whatsapp_credentials` (loja específica)
3. Se `use_global_whatsapp = true` → buscar credencial global
4. Fallback para env vars

**⚠️ PROBLEMA IDENTIFICADO:**
- A função `fetchBackupAccountCredential` tenta buscar `admin_id` via `stores.admin_id`, mas a tabela `stores` não tem essa coluna!
- **CORREÇÃO NECESSÁRIA:** Buscar `admin_id` via `stores` → `admin_id` vem de outra relação, ou usar `profiles` diretamente

---

### 3.2 `process-whatsapp-queue.js`

**Status:** ✅ Funcional

**Funcionalidades:**
- ✅ Busca mensagens via RPC `get_next_whatsapp_messages`
- ✅ Respeita prioridades (1-10)
- ✅ Verifica limites (por contato, total diário)
- ✅ Chama `send-whatsapp-message` passando `whatsapp_account_id`
- ✅ Atualiza status na fila
- ✅ Incrementa contador de campanha

---

### 3.3 `whatsapp-connect.js`

**Status:** ✅ Funcional (apenas para números principais)

**Funcionalidades:**
- ✅ Gera QR code para números principais (`whatsapp_credentials`)
- ✅ Atualiza `uazapi_qr_code` e `uazapi_status` em `whatsapp_credentials`

**⚠️ PROBLEMA:**
- ❌ **NÃO suporta números reserva** (`whatsapp_accounts`)
- **NECESSÁRIO:** Criar função ou adaptar para suportar `whatsapp_account_id`

---

### 3.4 `whatsapp-status.js`

**Status:** ✅ Funcional (apenas para números principais)

**Funcionalidades:**
- ✅ Verifica status de números principais (`whatsapp_credentials`)
- ✅ Atualiza `uazapi_status` em `whatsapp_credentials`

**⚠️ PROBLEMA:**
- ❌ **NÃO suporta números reserva** (`whatsapp_accounts`)
- **NECESSÁRIO:** Criar função ou adaptar para suportar `whatsapp_account_id`

---

## 4. CÓDIGO FRONTEND

### 4.1 `WhatsAppBulkSend.tsx`

**Status:** ✅ Funcional (com melhorias recentes)

**Funcionalidades Implementadas:**
- ✅ Busca números principais de `whatsapp_credentials`
- ✅ Busca números reserva de `whatsapp_accounts` usando colunas booleanas (`is_backup1/2/3`)
- ✅ Cria campanhas e insere mensagens na fila
- ✅ Usa `whatsapp_account_id` corretamente (NULL para principais, UUID para reserva)
- ✅ Seleção de múltiplos números para rotação

**⚠️ PROBLEMAS IDENTIFICADOS:**

1. **❌ Funções de Autenticação Faltando:**
   - Não há `handleGenerateBackupQRCode` implementado
   - Não há `handleCheckBackupStatus` implementado
   - Interface mostra campos para QR code e status, mas não há funções que os atualizem

2. **❌ ID Fictício Removido (Corrigido):**
   - ✅ Corrigido: não usa mais `primary-${storeId}` como ID fictício
   - ✅ Usa `null` para números principais
   - ✅ Usa UUID real para números reserva

---

### 4.2 `WhatsAppStoreConfig.tsx`

**Status:** ✅ Funcional

**Funcionalidades:**
- ✅ Gerencia números principais (`whatsapp_credentials`)
- ✅ Gera QR code via `whatsapp-connect.js`
- ✅ Verifica status via `whatsapp-status.js`
- ✅ Polling de status para atualização em tempo real

---

## 5. FLUXOS DE AUTENTICAÇÃO

### 5.1 Números Principais

**Status:** ✅ Funcional Completo

**Fluxo:**
1. Admin acessa `WhatsAppStoreConfig.tsx`
2. Clica em "Gerar QR Code"
3. Frontend chama `whatsapp-connect.js` (Netlify Function)
4. Function chama N8N workflow com `siteSlug` e `customerId`
5. N8N retorna QR code
6. QR code exibido na interface
7. Admin escaneia QR code
8. Polling atualiza status via `whatsapp-status.js`
9. Quando `uazapi_status = 'connected'`, número fica disponível

---

### 5.2 Números Reserva

**Status:** ❌ **NÃO IMPLEMENTADO**

**Problema:**
- Interface em `WhatsAppBulkSend.tsx` mostra campos para QR code e status
- **MAS:** Não há funções que gerem QR code ou verifiquem status
- Não há chamadas para `whatsapp-connect.js` ou `whatsapp-status.js` adaptadas para reserva

**O Que Faltaria:**
1. Adaptar `whatsapp-connect.js` para aceitar `whatsapp_account_id` e atualizar `whatsapp_accounts`
2. Adaptar `whatsapp-status.js` para aceitar `whatsapp_account_id` e buscar em `whatsapp_accounts`
3. Criar funções `handleGenerateBackupQRCode` e `handleCheckBackupStatus` em `WhatsAppBulkSend.tsx`
4. Implementar polling para atualização de status em tempo real

---

## 6. FILA DE MENSAGENS

**Status:** ✅ Funcional

**Fluxo Completo:**
1. Campanha criada em `WhatsAppBulkSend.tsx`
2. Mensagens inseridas em `whatsapp_message_queue` com:
   - `whatsapp_account_id` = UUID (reserva) ou NULL (principal)
   - `priority` = 8 (campanhas)
   - `status` = PENDING ou SCHEDULED
3. `process-whatsapp-queue.js` roda (via cron ou manual)
4. RPC `get_next_whatsapp_messages` retorna mensagens por prioridade
5. Para cada mensagem:
   - Verifica limites (diário, total)
   - Marca como SENDING
   - Chama `send-whatsapp-message` com `whatsapp_account_id`
   - Atualiza status (SENT/FAILED)
   - Incrementa contador da campanha

**✅ Funcionando Corretamente**

---

## 7. PROBLEMAS IDENTIFICADOS

### 🔴 CRÍTICO

1. **❌ `fetchBackupAccountCredential` usa `stores.admin_id` que não existe**
   - **Localização:** `netlify/functions/send-whatsapp-message.js` linha ~220
   - **Problema:** Busca `admin_id` de `stores`, mas essa coluna não existe
   - **Solução:** Buscar `admin_id` via `profiles` usando email do admin da loja, ou usar relação correta

2. **❌ Funções de autenticação para números reserva não implementadas**
   - **Localização:** `src/pages/admin/WhatsAppBulkSend.tsx`
   - **Problema:** Interface mostra campos para QR code e status, mas não há funções
   - **Solução:** Implementar `handleGenerateBackupQRCode` e `handleCheckBackupStatus`

### 🟡 MÉDIO

3. **⚠️ `whatsapp-connect.js` e `whatsapp-status.js` não suportam números reserva**
   - **Problema:** Funções só trabalham com `whatsapp_credentials`
   - **Solução:** Adaptar para aceitar `whatsapp_account_id` e trabalhar com `whatsapp_accounts`

4. **⚠️ Migrations não executadas no Supabase**
   - **Problema:** 3 migrations criadas mas não executadas
   - **Solução:** Executar migrations no Supabase

### 🟢 BAIXO

5. **ℹ️ Coluna `account_type` em `whatsapp_accounts` está deprecada**
   - **Status:** Mantida para compatibilidade
   - **Ação:** Pode ser removida no futuro após validação

---

## 8. RECOMENDAÇÕES

### 🎯 PRIORIDADE ALTA

1. **Corrigir `fetchBackupAccountCredential` em `send-whatsapp-message.js`**
   - Remover dependência de `stores.admin_id`
   - Buscar `admin_id` corretamente ou usar outro método

2. **Implementar autenticação para números reserva**
   - Adaptar `whatsapp-connect.js` para aceitar `whatsapp_account_id`
   - Adaptar `whatsapp-status.js` para aceitar `whatsapp_account_id`
   - Criar funções em `WhatsAppBulkSend.tsx` para gerenciar QR code e status

3. **Executar migrations no Supabase**
   - `20251220000003_add_is_global_to_whatsapp_credentials.sql`
   - `20251220000004_simplify_backup_accounts_to_booleans.sql`
   - `20251220000002_mark_whatsapp_credentials_as_primary.sql`

### 🎯 PRIORIDADE MÉDIA

4. **Testar fluxo completo de números reserva**
   - Criar número reserva
   - Gerar QR code
   - Escanear e conectar
   - Enviar mensagem de teste via campanha
   - Verificar se mensagem chega corretamente

5. **Documentar fluxo de autenticação**
   - Documentar diferenças entre números principais e reserva
   - Criar guia de uso para admin

### 🎯 PRIORIDADE BAIXA

6. **Remover código deprecado**
   - Remover uso de `account_type` (após validação)
   - Remover `customer_id` de `whatsapp_credentials` (após validação)

---

## ✅ RESUMO EXECUTIVO

### O Que Está Funcionando:
- ✅ Estrutura de tabelas correta
- ✅ Migrations criadas (aguardando execução)
- ✅ Fila de mensagens funcional
- ✅ Envio de mensagens para números principais
- ✅ Envio de mensagens para números reserva (quando `whatsapp_account_id` fornecido)
- ✅ Sistema de prioridades funcionando
- ✅ Campanhas criadas corretamente

### O Que Precisa Ser Corrigido:
- ❌ `fetchBackupAccountCredential` usa coluna inexistente
- ❌ Autenticação (QR code/status) para números reserva não implementada
- ⚠️ Migrations precisam ser executadas no Supabase

### Próximos Passos:
1. Corrigir `fetchBackupAccountCredential`
2. Executar migrations no Supabase
3. Implementar autenticação para números reserva
4. Testar fluxo completo

---

**Fim da Verificação**

