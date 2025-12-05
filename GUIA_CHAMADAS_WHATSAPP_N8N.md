# 📱 Guia Completo: Chamadas WhatsApp via n8n

## 📋 Visão Geral

Este documento descreve como o frontend deve fazer chamadas para autenticação e envio de mensagens WhatsApp através de webhooks n8n.

**Arquitetura:**
```
Frontend (React) → Helper n8n (post/get) → Webhook n8n → UAZAPI/Chatwoot → WhatsApp
```

---

## 🔐 1. AUTENTICAÇÃO WHATSAPP (Conectar UAZAPI)

### 1.1. Função Frontend

```typescript
import * as whatsappAPI from "@/lib/n8n-whatsapp";

// Conectar WhatsApp e gerar QR Code
const result = await whatsappAPI.connectUAZAPI(
  siteSlug,      // string: slug do site (ex: "elevea")
  customerId,    // string: email do cliente (ex: "cliente@email.com")
  uazapiToken    // string: token UAZAPI (pode ser vazio, backend busca do banco)
);
```

### 1.2. Implementação Interna (n8n-whatsapp.ts)

```typescript
export async function connectUAZAPI(
  siteSlug: string,
  customerId: string,
  uazapiToken: string
): Promise<WhatsAppCredentials> {
  try {
    const data = await post('/api/whatsapp/auth/connect', {
      siteSlug,
      customerId,
      uazapiToken,
    });
    
    // Processar resposta
    let qrCode = data.qrCode || data.qr_code || data.qrcode || null;
    const instanceId = data.instanceId || data.instance_id || null;
    const phoneNumber = data.phoneNumber || data.phone_number || null;
    const status = data.status || (qrCode ? 'connecting' : (phoneNumber ? 'connected' : 'disconnected'));
    
    // Garantir prefixo data:image/png;base64, no QR code
    if (qrCode && typeof qrCode === 'string') {
      if (!qrCode.startsWith('data:') && !qrCode.startsWith('http')) {
        qrCode = `data:image/png;base64,${qrCode}`;
      }
    }
    
    return {
      connected: data.ok === true || data.success === true || (status === 'connected'),
      status: status,
      qrCode: qrCode,
      instanceId: instanceId,
      phoneNumber: phoneNumber,
    };
  } catch (error: any) {
    return {
      connected: false,
      status: 'error',
      error: error.message || 'Erro ao conectar UAZAPI',
    };
  }
}
```

### 1.3. Chamada HTTP Real

**Método:** `POST`  
**URL:** `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect`  
**Headers:**
```json
{
  "Content-Type": "application/json",
  "X-APP-KEY": "#mmP220411"
}
```

**Body:**
```json
{
  "siteSlug": "elevea",
  "customerId": "cliente@email.com",
  "uazapiToken": "token_uazapi_aqui" // Opcional: backend pode buscar do banco
}
```

**Resposta Esperada:**
```json
{
  "ok": true,
  "success": true,
  "status": "connecting",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "instanceId": "r07d934157d4627",
  "phoneNumber": null
}
```

**Quando Conectado:**
```json
{
  "ok": true,
  "success": true,
  "status": "connected",
  "qrCode": null,
  "instanceId": "r07d934157d4627",
  "phoneNumber": "5596981032928"
}
```

---

## 🔍 2. VERIFICAR STATUS DA CONEXÃO

### 2.1. Função Frontend

```typescript
// Verificar status da conexão WhatsApp
const result = await whatsappAPI.checkStatus(siteSlug, customerId);
```

### 2.2. Implementação Interna

```typescript
export async function checkStatus(
  siteSlug: string,
  customerId: string
): Promise<WhatsAppCredentials> {
  try {
    const data = await get(
      `/api/whatsapp/auth/status?siteSlug=${encodeURIComponent(siteSlug)}&customerId=${encodeURIComponent(customerId)}`
    );
    
    // Processar resposta (mesma lógica do connectUAZAPI)
    let qrCode = data.qrCode || data.qr_code || data.qrcode || null;
    const instanceId = data.instanceId || data.instance_id || null;
    const phoneNumber = data.phoneNumber || data.phone_number || null;
    const status = data.status || (qrCode ? 'connecting' : (phoneNumber ? 'connected' : 'disconnected'));
    
    // Garantir prefixo data:image/png;base64, no QR code
    if (qrCode && typeof qrCode === 'string') {
      if (!qrCode.startsWith('data:') && !qrCode.startsWith('http')) {
        qrCode = `data:image/png;base64,${qrCode}`;
      }
    }
    
    return {
      connected: data.connected === true || status === 'connected',
      status: status,
      qrCode: qrCode,
      instanceId: instanceId,
      phoneNumber: phoneNumber,
    };
  } catch (error: any) {
    return {
      connected: false,
      status: 'error',
      error: error.message || 'Erro ao verificar status',
    };
  }
}
```

### 2.3. Chamada HTTP Real

**Método:** `GET`  
**URL:** `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/status?siteSlug=elevea&customerId=cliente@email.com`  
**Headers:**
```json
{
  "X-APP-KEY": "#mmP220411"
}
```

**Resposta:** Mesma estrutura do `connectUAZAPI`

---

## 💬 3. ENVIAR MENSAGEM WHATSAPP

### 3.1. Função Frontend

```typescript
// Enviar mensagem WhatsApp
const result = await whatsappAPI.sendMessage(
  siteSlug,      // string: slug do site
  customerId,    // string: email do cliente
  phoneNumber,   // string: telefone em formato E.164 (ex: "5596981032928")
  message        // string: texto da mensagem
);

if (result.success) {
  console.log('Mensagem enviada com sucesso!');
} else {
  console.error('Erro:', result.error);
}
```

### 3.2. Implementação Interna

```typescript
export async function sendMessage(
  siteSlug: string,
  customerId: string,
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await post('/api/whatsapp/send', {
      siteSlug,
      customerId,
      phoneNumber,
      message,
    });
    
    return {
      success: data.ok === true || data.success === true,
      error: data.error,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao enviar mensagem',
    };
  }
}
```

### 3.3. Chamada HTTP Real

**Método:** `POST`  
**URL:** `https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/send`  
**Headers:**
```json
{
  "Content-Type": "application/json",
  "X-APP-KEY": "#mmP220411"
}
```

**Body:**
```json
{
  "siteSlug": "elevea",
  "customerId": "cliente@email.com",
  "phoneNumber": "5596981032928",
  "message": "Olá! Esta é uma mensagem de teste."
}
```

**Resposta Esperada:**
```json
{
  "ok": true,
  "success": true,
  "message": "Mensagem enviada com sucesso"
}
```

**Erro:**
```json
{
  "ok": false,
  "success": false,
  "error": "Erro ao enviar mensagem"
}
```

---

## 🔧 4. HELPER n8n (post/get)

### 4.1. Função `post()`

```typescript
// src/lib/n8n.ts
const BASE = (import.meta.env.VITE_N8N_BASE_URL || "https://fluxos.eleveaagencia.com.br").replace(/\/$/, "");
const PREFIX = "/webhook";
const AUTH_HEADER = import.meta.env.VITE_N8N_AUTH_HEADER || "#mmP220411";
const AUTH_HEADER_NAME = "X-APP-KEY";

export async function post<T = any>(path: string, body: Json): Promise<T> {
  const finalUrl = `${BASE}${PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  
  const headers: Record<string, string> = { 
    "Content-Type": "application/json"
  };
  
  if (AUTH_HEADER) {
    headers[AUTH_HEADER_NAME] = AUTH_HEADER;
  }
  
  const res = await fetch(finalUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    mode: 'cors',
    credentials: 'omit',
  });
  
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  
  if (isJson) {
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    
    return data as T;
  }
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  
  return {} as T;
}
```

### 4.2. Função `get()`

```typescript
export async function get<T = any>(path: string): Promise<T> {
  const finalUrl = `${BASE}${PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  
  const headers: Record<string, string> = {};
  
  if (AUTH_HEADER) {
    headers[AUTH_HEADER_NAME] = AUTH_HEADER;
  }
  
  const res = await fetch(finalUrl, { headers });
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    throw new Error((data.error || data.message || `HTTP ${res.status}`));
  }
  
  return data as T;
}
```

---

## 📝 5. NORMALIZAÇÃO DE TELEFONE

### 5.1. Formato E.164 (Brasil)

O telefone deve estar no formato **E.164** para celular brasileiro:
- Formato: `55 + DDD + 9 + 8 dígitos`
- Exemplo: `5596981032928` (55 + 96 + 9 + 81032928)

### 5.2. Função de Normalização

```typescript
function toE164CellBR(raw: string): string {
  let d = raw.replace(/\D/g, ""); // Remove não-dígitos
  
  // Remove 55 extra no começo
  if (d.startsWith("55")) d = d.slice(2);
  
  if (d.length >= 11) {
    // Pega os últimos 11 dígitos (DDD + 9 + 8)
    let n11 = d.slice(-11);
    const ddd = n11.slice(0, 2);
    let rest = n11.slice(2); // 9 dígitos
    
    if (rest.length !== 9) return "";
    if (rest[0] !== "9") rest = "9" + rest.slice(0, 8); // Força o 9
    
    return "55" + ddd + rest;
  }
  
  if (d.length === 10) {
    // DDD + 8 → vira DDD + 9 + 8
    const ddd = d.slice(0, 2);
    const line8 = d.slice(2);
    return "55" + ddd + "9" + line8;
  }
  
  return ""; // Inválido
}
```

**Exemplos:**
- `5596981032928` → `5596981032928` ✅
- `559681032928` → `5596981032928` ✅ (adiciona 9)
- `9681032928` → `5596981032928` ✅ (adiciona 55)
- `6981032928` → `5596981032928` ✅ (adiciona 55 e 9)

---

## 🔄 6. FLUXO COMPLETO DE AUTENTICAÇÃO

### 6.1. Passo a Passo

1. **Usuário clica em "Conectar WhatsApp"**
   ```typescript
   await whatsappAPI.connectUAZAPI(siteSlug, customerId, '');
   ```

2. **Frontend recebe QR Code**
   ```typescript
   // result.qrCode = "data:image/png;base64,..."
   // result.status = "connecting"
   ```

3. **Exibir QR Code para usuário escanear**

4. **Polling automático a cada 5 segundos**
   ```typescript
   useEffect(() => {
     if (status.status === "connecting") {
       const interval = setInterval(() => {
         checkStatus();
       }, 5000);
       return () => clearInterval(interval);
     }
   }, [status.status]);
   ```

5. **Quando conectado:**
   ```typescript
   // result.status = "connected"
   // result.phoneNumber = "5596981032928"
   // result.qrCode = null
   ```

---

## 📤 7. FLUXO COMPLETO DE ENVIO DE MENSAGEM

### 7.1. Passo a Passo

1. **Usuário digita telefone e mensagem**

2. **Normalizar telefone para E.164**
   ```typescript
   const normalizedPhone = toE164CellBR(phone);
   ```

3. **Enviar mensagem**
   ```typescript
   const result = await whatsappAPI.sendMessage(
     siteSlug,
     customerId,
     normalizedPhone,
     message
   );
   ```

4. **Verificar sucesso**
   ```typescript
   if (result.success) {
     // Mensagem enviada com sucesso
     // Atualizar UI com mensagem enviada
   } else {
     // Exibir erro
     console.error(result.error);
   }
   ```

---

## ⚙️ 8. VARIÁVEIS DE AMBIENTE

### 8.1. Frontend (.env)

```bash
# URL base do n8n
VITE_N8N_BASE_URL=https://fluxos.eleveaagencia.com.br

# Header de autenticação para webhooks
VITE_N8N_AUTH_HEADER=#mmP220411

# Modo (prod/test) - opcional
VITE_N8N_MODE=prod
```

### 8.2. Netlify (Environment Variables)

```bash
# Token UAZAPI (usado no backend)
UAZAPI_TOKEN=seu_token_uazapi_aqui

# Instance ID UAZAPI (opcional)
UAZAPI_INSTANCE_ID=seu_instance_id_aqui
```

---

## 🎯 9. RESUMO DAS CHAMADAS

### 9.1. Autenticação

| Função | Endpoint | Método | Payload |
|--------|----------|--------|---------|
| `connectUAZAPI` | `/api/whatsapp/auth/connect` | POST | `{ siteSlug, customerId, uazapiToken }` |
| `checkStatus` | `/api/whatsapp/auth/status` | GET | Query params: `siteSlug`, `customerId` |
| `refreshQRCode` | `/api/whatsapp/auth/qrcode/refresh` | POST | `{ siteSlug, customerId }` |
| `disconnect` | `/api/whatsapp/auth/disconnect` | POST | `{ siteSlug, customerId }` |

### 9.2. Mensagens

| Função | Endpoint | Método | Payload |
|--------|----------|--------|---------|
| `sendMessage` | `/api/whatsapp/send` | POST | `{ siteSlug, customerId, phoneNumber, message }` |
| `listMessages` | `/api/whatsapp/messages` | GET | Query params: `siteSlug`, `customerId`, `limit`, `offset` |
| `listContacts` | `/api/whatsapp/contacts` | GET | Query params: `siteSlug`, `customerId` |

### 9.3. Headers Obrigatórios

Todas as requisições devem incluir:
```json
{
  "X-APP-KEY": "#mmP220411"
}
```

E requisições POST devem incluir:
```json
{
  "Content-Type": "application/json"
}
```

---

## 🐛 10. TRATAMENTO DE ERROS

### 10.1. Erros Comuns

**Erro: "VITE_N8N_BASE_URL não definido"**
- **Causa:** Variável de ambiente não configurada
- **Solução:** Configurar `VITE_N8N_BASE_URL` no `.env` ou Netlify

**Erro: "X-APP-KEY não configurado"**
- **Causa:** `VITE_N8N_AUTH_HEADER` não configurado
- **Solução:** Configurar `VITE_N8N_AUTH_HEADER` no `.env` ou Netlify

**Erro: "Erro ao conectar UAZAPI"**
- **Causa:** Token UAZAPI inválido ou instância não criada
- **Solução:** Verificar token no banco de dados ou configurar no Netlify

**Erro: "Erro ao enviar mensagem"**
- **Causa:** WhatsApp não conectado ou número inválido
- **Solução:** Verificar status da conexão e formato do telefone (E.164)

### 10.2. Validações Recomendadas

```typescript
// Antes de conectar
if (!siteSlug || !customerId) {
  throw new Error('siteSlug e customerId são obrigatórios');
}

// Antes de enviar mensagem
if (!phoneNumber || !message) {
  throw new Error('Telefone e mensagem são obrigatórios');
}

const normalizedPhone = toE164CellBR(phoneNumber);
if (!normalizedPhone) {
  throw new Error('Telefone inválido. Use formato brasileiro (DDD + número)');
}
```

---

## 📚 11. EXEMPLO COMPLETO DE USO

```typescript
import * as whatsappAPI from "@/lib/n8n-whatsapp";

// 1. Conectar WhatsApp
async function conectarWhatsApp() {
  const result = await whatsappAPI.connectUAZAPI(
    "elevea",
    "cliente@email.com",
    "" // Token será buscado do banco pelo backend
  );
  
  if (result.qrCode) {
    // Exibir QR Code
    console.log('QR Code:', result.qrCode);
  }
  
  if (result.status === 'connected') {
    console.log('Conectado! Número:', result.phoneNumber);
  }
}

// 2. Verificar status periodicamente
async function verificarStatus() {
  const result = await whatsappAPI.checkStatus("elevea", "cliente@email.com");
  console.log('Status:', result.status);
}

// 3. Enviar mensagem
async function enviarMensagem() {
  const telefone = "5596981032928"; // E.164
  const mensagem = "Olá! Esta é uma mensagem de teste.";
  
  const result = await whatsappAPI.sendMessage(
    "elevea",
    "cliente@email.com",
    telefone,
    mensagem
  );
  
  if (result.success) {
    console.log('Mensagem enviada com sucesso!');
  } else {
    console.error('Erro:', result.error);
  }
}
```

---

## ✅ 12. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Configurar variáveis de ambiente (`VITE_N8N_BASE_URL`, `VITE_N8N_AUTH_HEADER`)
- [ ] Implementar helper `post()` e `get()` com header `X-APP-KEY`
- [ ] Implementar função `connectUAZAPI()` com tratamento de QR code
- [ ] Implementar função `checkStatus()` com polling automático
- [ ] Implementar função `sendMessage()` com normalização de telefone
- [ ] Implementar função `toE164CellBR()` para normalização
- [ ] Adicionar tratamento de erros em todas as funções
- [ ] Testar conexão e geração de QR code
- [ ] Testar envio de mensagem com telefone normalizado
- [ ] Implementar UI para exibir QR code e status

---

**Última atualização:** 2025-12-05  
**Versão:** 1.0.0

