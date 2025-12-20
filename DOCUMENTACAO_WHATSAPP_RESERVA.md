# 📚 DOCUMENTAÇÃO - SISTEMA DE NÚMEROS RESERVA WHATSAPP

**Data:** 2025-12-20  
**Versão:** 1.0

---

## 📋 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura de Dados](#3-estrutura-de-dados)
4. [Fluxos de Autenticação](#4-fluxos-de-autenticação)
5. [Fluxos de Envio](#5-fluxos-de-envio)
6. [API e Funções](#6-api-e-funções)
7. [Interface do Usuário](#7-interface-do-usuário)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. VISÃO GERAL

O sistema suporta dois tipos de números WhatsApp:

### Números Principais
- **Onde:** Tabela `whatsapp_credentials`
- **Gerenciamento:** Página de Configurações → WhatsApp
- **Uso:** Envio padrão de mensagens (cashback, notificações, etc.)
- **Características:**
  - Um por loja (por `site_slug`)
  - Vinculado ao `admin_id` (profile.id)
  - Gerenciado via `WhatsAppStoreConfig.tsx`

### Números Reserva
- **Onde:** Tabela `whatsapp_accounts`
- **Gerenciamento:** Página de Envio em Massa → Configurações
- **Uso:** Campanhas de envio em massa (rotação de números)
- **Características:**
  - Até 3 por loja (`is_backup1`, `is_backup2`, `is_backup3`)
  - Vinculado ao `store_id`
  - Gerenciado via `WhatsAppBulkSend.tsx`

---

## 2. ARQUITETURA

### Componentes Principais

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  WhatsAppStoreConfig.tsx  │  WhatsAppBulkSend.tsx      │
│  (Números Principais)     │  (Números Reserva)         │
│                           │                             │
│  • handleGenerateQRCode   │  • handleGenerateBackupQR  │
│  • handleCheckStatus      │  • handleCheckBackupStatus │
│  • startPollingForStore   │  • startPollingForBackup   │
│                           │                             │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌─────────────────────────────────────────────────────────┐
│              NETLIFY FUNCTIONS (Node.js)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  whatsapp-connect.js      │  whatsapp-status.js        │
│  • Aceita whatsapp_account_id (opcional)                │
│  • Se fornecido: busca whatsapp_accounts                │
│  • Se não: busca whatsapp_credentials (compatibilidade) │
│                           │                             │
│  send-whatsapp-message.js │  process-whatsapp-queue.js │
│  • fetchBackupAccountCredential (novo)                  │
│  • Suporta whatsapp_account_id na fila                  │
│                           │                             │
└─────────────────────────────────────────────────────────┘
                            │
                            │ N8N Webhooks
                            │
┌─────────────────────────────────────────────────────────┐
│              N8N WORKFLOWS + UazAPI                      │
│  • Gera QR codes                                         │
│  • Verifica status                                       │
│  • Envia mensagens                                       │
└─────────────────────────────────────────────────────────┘
                            │
                            │ Queries
                            │
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL)                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  whatsapp_credentials     │  whatsapp_accounts          │
│  • admin_id + site_slug   │  • store_id                 │
│  • is_global              │  • is_backup1/2/3           │
│  • is_backup = false      │  • uazapi_qr_code           │
│                           │  • uazapi_status            │
│                           │                             │
│  whatsapp_message_queue   │  whatsapp_campaigns         │
│  • whatsapp_account_id    │  • Referência à campanha    │
│  • NULL = principal       │                             │
│  • UUID = reserva         │                             │
│                           │                             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. ESTRUTURA DE DADOS

### Tabela: `whatsapp_credentials` (Números Principais)

```sql
CREATE TABLE whatsapp_credentials (
    admin_id UUID REFERENCES profiles(id),
    site_slug VARCHAR(255),
    customer_id VARCHAR(255),  -- DEPRECADO
    is_global BOOLEAN DEFAULT false,
    is_backup BOOLEAN DEFAULT false,  -- Sempre false
    uazapi_instance_id TEXT,
    uazapi_token TEXT,
    uazapi_phone_number TEXT,
    uazapi_qr_code TEXT,
    uazapi_status TEXT,
    status VARCHAR(50) DEFAULT 'active',
    PRIMARY KEY (admin_id, site_slug)
);
```

**Características:**
- Um registro por combinação `(admin_id, site_slug)`
- `is_global = true` → credencial global (fallback)
- `is_backup = false` → sempre false (principais nunca são reserva)

---

### Tabela: `whatsapp_accounts` (Números Reserva)

```sql
CREATE TABLE whatsapp_accounts (
    id UUID PRIMARY KEY,
    store_id UUID REFERENCES stores(id),
    phone TEXT NOT NULL,
    is_backup1 BOOLEAN DEFAULT false,
    is_backup2 BOOLEAN DEFAULT false,
    is_backup3 BOOLEAN DEFAULT false,
    is_connected BOOLEAN DEFAULT false,
    uazapi_instance_id TEXT,
    uazapi_token TEXT,
    uazapi_qr_code TEXT,
    uazapi_status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CHECK ((is_backup1::int + is_backup2::int + is_backup3::int) <= 1)
);
```

**Características:**
- Múltiplos registros por `store_id`
- Apenas uma das colunas `is_backup1/2/3` pode ser `true`
- Constraint garante que não há duplicação de backup types

---

### Tabela: `whatsapp_message_queue` (Fila Unificada)

```sql
CREATE TABLE whatsapp_message_queue (
    id UUID PRIMARY KEY,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    store_id UUID REFERENCES stores(id),
    whatsapp_account_id UUID REFERENCES whatsapp_accounts(id),
    priority INTEGER DEFAULT 5,
    message_type TEXT,  -- CAMPAIGN, CASHBACK, NOTIFICATION, etc.
    status TEXT DEFAULT 'PENDING',
    campaign_id UUID REFERENCES whatsapp_campaigns(id),
    created_at TIMESTAMPTZ,
    ...
);
```

**Lógica de `whatsapp_account_id`:**
- `NULL` → usar número principal (via `whatsapp_credentials`)
- `UUID` → usar número reserva (via `whatsapp_accounts`)

---

## 4. FLUXOS DE AUTENTICAÇÃO

### 4.1. Autenticação de Número Principal

**Localização:** `WhatsAppStoreConfig.tsx`

**Fluxo:**
1. Admin clica "Gerar QR Code"
2. Frontend chama `connectWhatsApp({ siteSlug, customerId })`
3. Netlify Function `whatsapp-connect.js` chama N8N
4. N8N retorna QR code (base64)
5. QR code é exibido na UI
6. Polling inicia (`startPollingForStore`)
7. Admin escaneia QR code no WhatsApp
8. Status muda para `connected`
9. Dados são salvos em `whatsapp_credentials`

**Tabela:** `whatsapp_credentials`  
**Identificador:** `admin_id` + `site_slug`

---

### 4.2. Autenticação de Número Reserva

**Localização:** `WhatsAppBulkSend.tsx`

**Fluxo:**
1. Admin clica "Gerar QR Code" em um número reserva
2. Frontend chama `connectBackupWhatsApp({ siteSlug, customerId, whatsapp_account_id })`
3. Netlify Function `whatsapp-connect.js`:
   - Detecta `whatsapp_account_id`
   - Busca dados de `whatsapp_accounts`
   - Obtém `site_slug` da loja
   - Chama N8N normalmente
   - Atualiza `whatsapp_accounts` (não `whatsapp_credentials`)
4. QR code é exibido na UI
5. Polling inicia (`startPollingForBackupAccount`)
6. Admin escaneia QR code
7. Status muda para `connected`
8. Dados são salvos em `whatsapp_accounts`

**Tabela:** `whatsapp_accounts`  
**Identificador:** `id` (UUID)

---

## 5. FLUXOS DE ENVIO

### 5.1. Envio com Número Principal

**Fluxo:**
1. Sistema cria mensagem na fila com `whatsapp_account_id = NULL`
2. `process-whatsapp-queue.js` processa mensagem
3. Chama `send-whatsapp-message.js` com `whatsapp_account_id = NULL`
4. `send-whatsapp-message.js`:
   - Detecta que `whatsapp_account_id` é `NULL`
   - Busca credenciais em `whatsapp_credentials` (número principal)
   - Envia mensagem via N8N

---

### 5.2. Envio com Número Reserva

**Fluxo:**
1. Campanha é criada com `whatsapp_account_id = UUID` (reserva)
2. Mensagens são inseridas na fila com `whatsapp_account_id = UUID`
3. `process-whatsapp-queue.js` processa mensagem
4. Chama `send-whatsapp-message.js` com `whatsapp_account_id = UUID`
5. `send-whatsapp-message.js`:
   - Detecta que `whatsapp_account_id` foi fornecido
   - Chama `fetchBackupAccountCredential(UUID)`
   - Busca em `whatsapp_accounts`:
     - Verifica se está conectado (`is_connected = true`)
     - Obtém `uazapi_token` e `uazapi_instance_id`
     - Obtém `site_slug` da loja
     - Obtém `customer_id` da credencial principal
   - Envia mensagem via N8N usando credenciais do reserva

---

### 5.3. Rotação de Números

**Fluxo:**
1. Campanha é criada com múltiplos números (principal + reservas)
2. `handleSend` em `WhatsAppBulkSend.tsx`:
   - Distribui mensagens entre números
   - Primeira mensagem: `whatsapp_account_id = NULL` (principal)
   - Segunda mensagem: `whatsapp_account_id = UUID1` (reserva 1)
   - Terceira mensagem: `whatsapp_account_id = UUID2` (reserva 2)
   - Quarta mensagem: `whatsapp_account_id = NULL` (principal novamente)
   - E assim por diante...
3. Cada mensagem é processada usando o número correto

---

## 6. API E FUNÇÕES

### 6.1. Frontend (`src/lib/whatsapp.ts`)

#### `connectWhatsApp(params)`
- **Uso:** Números principais
- **Parâmetros:** `{ siteSlug, customerId }`
- **Retorna:** `WhatsAppConnectResponse`

#### `connectBackupWhatsApp(params)`
- **Uso:** Números reserva
- **Parâmetros:** `{ siteSlug, customerId, whatsapp_account_id? }`
- **Retorna:** `WhatsAppConnectResponse`
- **Diferença:** Passa `whatsapp_account_id` para Netlify Function

#### `fetchWhatsAppStatus(params)`
- **Uso:** Números principais
- **Parâmetros:** `{ siteSlug, customerId }`
- **Retorna:** `WhatsAppStatusResponse`

#### `fetchBackupWhatsAppStatus(params)`
- **Uso:** Números reserva
- **Parâmetros:** `{ siteSlug, customerId, whatsapp_account_id? }`
- **Retorna:** `WhatsAppStatusResponse`
- **Diferença:** Passa `whatsapp_account_id` para Netlify Function

#### `isTerminalStatus(status)`
- **Uso:** Ambos (compartilhado)
- **Retorna:** `boolean`
- **Lógica:** `status === 'connected' || status === 'error'`

---

### 6.2. Backend (`netlify/functions/`)

#### `whatsapp-connect.js`
- **Endpoint:** `/.netlify/functions/whatsapp-connect`
- **Método:** GET
- **Parâmetros:** `siteSlug`, `customerId`, `whatsapp_account_id?` (opcional)
- **Lógica:**
  - Se `whatsapp_account_id` fornecido → atualiza `whatsapp_accounts`
  - Se não fornecido → atualiza `whatsapp_credentials` (compatibilidade)

#### `whatsapp-status.js`
- **Endpoint:** `/.netlify/functions/whatsapp-status`
- **Método:** GET
- **Parâmetros:** `siteSlug`, `customerId`, `whatsapp_account_id?` (opcional)
- **Lógica:** Similar ao connect, mas apenas consulta status

#### `send-whatsapp-message.js`
- **Endpoint:** `/.netlify/functions/send-whatsapp-message`
- **Método:** POST
- **Body:** `{ phone, message, store_id, whatsapp_account_id? }`
- **Lógica:**
  - Se `whatsapp_account_id` fornecido → usa `fetchBackupAccountCredential`
  - Se `NULL` ou não fornecido → usa número principal

#### `process-whatsapp-queue.js`
- **Endpoint:** `/.netlify/functions/process-whatsapp-queue`
- **Método:** POST (ou cron job)
- **Lógica:**
  - Busca mensagens via RPC `get_next_whatsapp_messages`
  - Para cada mensagem, chama `send-whatsapp-message.js`
  - Passa `whatsapp_account_id` da fila para função de envio

---

## 7. INTERFACE DO USUÁRIO

### 7.1. Configuração de Números Principais

**Localização:** `/admin` → Tab "Configurações" → Seção WhatsApp

**Funcionalidades:**
- Lista de lojas
- Para cada loja:
  - Status badge (Conectado/Desconectado)
  - Botão "Gerar QR Code"
  - Botão "Verificar Status"
  - QR code display (quando disponível)

---

### 7.2. Configuração de Números Reserva

**Localização:** `/admin/whatsapp-bulk-send` → Passo 4 "Configurações"

**Funcionalidades:**
- Lista de números reserva (cards individuais)
- Para cada número:
  - Status badge colorido:
    - 🟢 Verde: Conectado
    - 🟡 Amarelo: QR Code necessário
    - ⚪ Cinza: Desconectado
    - 🔴 Vermelho: Erro
    - 🔵 Azul: Conectando...
  - QR code display (quando disponível)
  - Botão "Verificar Status"
  - Botão "Gerar QR Code"
  - Estados de loading/polling visuais
- Seleção de números para campanha:
  - Dropdown com apenas números conectados
  - Até 3 números reserva podem ser selecionados
  - Indicador visual (✓) para números conectados

---

## 8. TROUBLESHOOTING

### Problema: Número reserva não aparece

**Causas possíveis:**
1. Número não foi criado no banco
2. `store_id` não corresponde à loja selecionada
3. Nenhuma das colunas `is_backup1/2/3` está como `true`

**Solução:**
```sql
-- Verificar número
SELECT * FROM whatsapp_accounts WHERE store_id = '...';

-- Corrigir
UPDATE whatsapp_accounts 
SET is_backup1 = true 
WHERE id = '...';
```

---

### Problema: QR code não é gerado

**Causas possíveis:**
1. `site_slug` da loja não está preenchido
2. N8N workflow não está configurado
3. Erro na função Netlify

**Solução:**
- Verificar `site_slug` na tabela `stores`
- Verificar logs do Netlify Function
- Testar N8N workflow diretamente

---

### Problema: Mensagem não chega do número reserva

**Causas possíveis:**
1. `whatsapp_account_id` não está na fila
2. Número reserva não está conectado
3. `fetchBackupAccountCredential` não encontra dados

**Solução:**
- Verificar `whatsapp_account_id` na fila:
  ```sql
  SELECT whatsapp_account_id, status 
  FROM whatsapp_message_queue 
  WHERE campaign_id = '...';
  ```
- Verificar se número está conectado:
  ```sql
  SELECT is_connected, uazapi_status 
  FROM whatsapp_accounts 
  WHERE id = '...';
  ```
- Verificar logs de `send-whatsapp-message.js`

---

### Problema: Rotação não funciona

**Causas possíveis:**
1. Números não estão todos conectados
2. Lógica de distribuição incorreta
3. `alternateNumbers` não está marcado

**Solução:**
- Garantir que todos os números estão conectados
- Verificar lógica em `handleSend` (distribuição de `whatsapp_account_id`)
- Verificar checkbox "Alternar entre números" na UI

---

## 📝 NOTAS IMPORTANTES

1. **Compatibilidade:**
   - Números principais sempre funcionam (comportamento padrão)
   - Números reserva são opcionais
   - Sistema funciona mesmo sem números reserva configurados

2. **Prioridades:**
   - Mensagens de campanha: prioridade 8 (baixa)
   - Mensagens críticas (cashback, notificações): prioridade 1-3 (alta)
   - Sistema garante que mensagens críticas não são bloqueadas por campanhas

3. **Segurança:**
   - RLS (Row Level Security) aplicado em todas as tabelas
   - Admins só veem números de suas próprias lojas
   - Service role necessário para funções de processamento

4. **Performance:**
   - Polling usa intervalo de 12 segundos (para ambos os tipos)
   - Timeout de 2 minutos para polling automático
   - Fila processa até 50 mensagens por execução

---

**Fim da Documentação**

