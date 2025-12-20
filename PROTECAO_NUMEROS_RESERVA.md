# Proteção: Números Reserva Exclusivos para Campanhas

## ✅ Problema Resolvido

**ANTES:** Números reserva podiam ser usados indevidamente para mensagens normais (ponto, venda, ajuste, etc.).

**AGORA:** Números reserva são **EXCLUSIVAMENTE** para envio em massa (campanhas). Mensagens normais **SEMPRE** usam números principais ou global.

---

## 🔒 Proteções Implementadas

### 1. **Validação Rigorosa no `send-whatsapp-message.js`**

```javascript
// ANTES de usar whatsapp_account_id, verificar se é campanha válida
const isValidCampaign = campaign_id && message_type === 'CAMPAIGN';
const shouldUseBackup = whatsapp_account_id && isValidCampaign;

if (!isValidCampaign && whatsapp_account_id) {
  // BLOQUEADO: Log de segurança e ignorar whatsapp_account_id
  console.error('[WhatsApp] 🚨 BLOQUEADO: whatsapp_account_id fornecido mas NÃO é campanha!');
  // Continuar com números principais
}
```

**Proteção:** Se `whatsapp_account_id` for fornecido sem `campaign_id` e `message_type === 'CAMPAIGN'`, ele é **IGNORADO** e o sistema usa números principais.

---

### 2. **Validação na Fila (`process-whatsapp-queue.js`)**

```javascript
// Só passar whatsapp_account_id se realmente for campanha
const payload = {
  phone: item.phone,
  message: item.message,
  store_id: item.store_id,
};

if (item.campaign_id && item.message_type === 'CAMPAIGN') {
  payload.whatsapp_account_id = item.whatsapp_account_id;
  payload.campaign_id = item.campaign_id;
  payload.message_type = item.message_type;
}
```

**Proteção:** A fila só passa `whatsapp_account_id` para `send-whatsapp-message` se a mensagem tiver `campaign_id` e `message_type === 'CAMPAIGN'`.

---

### 3. **Instâncias Únicas para Números Reserva**

```javascript
// Gerar siteSlug único com sufixo para números reserva
let backupSuffix = '_backup1';
if (backupAccount.is_backup2) backupSuffix = '_backup2';
else if (backupAccount.is_backup3) backupSuffix = '_backup3';

const uniqueSiteSlug = storeSlug + backupSuffix; // Ex: 'loungerie_backup1'
```

**Proteção:** Números reserva sempre usam instâncias únicas no N8N/UazAPI (com sufixo `_backup1`, `_backup2`, `_backup3`), evitando conflitos com números principais.

**Aplicado em:**
- `whatsapp-connect.js` - Ao conectar números reserva
- `whatsapp-status.js` - Ao verificar status
- `send-whatsapp-message.js` - Ao buscar credenciais de números reserva

---

### 4. **Atualização Automática de Tokens**

**Problema anterior:** Tokens desatualizados no banco causavam erros de autorização.

**Solução implementada:**
- `whatsapp-status.js` sempre atualiza tokens quando N8N retorna novos valores
- `WhatsAppStoreConfig.tsx` sempre atualiza tokens quando recebe do N8N (mesmo se status for "disconnected")
- Proteção contra downgrade: Se status no banco é "connected" e token foi atualizado, mantém "connected" (evita downgrade por token antigo)

---

## 📋 Fluxo de Validação

```
1. Mensagem chega em send-whatsapp-message
   ↓
2. Verifica: whatsapp_account_id fornecido?
   ↓ SIM
3. Verifica: campaign_id presente E message_type === 'CAMPAIGN'?
   ↓ SIM → Usar número reserva
   ↓ NÃO → IGNORAR whatsapp_account_id, usar números principais
   ↓
4. Se não há whatsapp_account_id → Usar números principais (normal)
```

---

## 🔍 Logs de Segurança

Todas as tentativas de uso incorreto de números reserva são logadas:

```
[WhatsApp] 🚨 BLOQUEADO: whatsapp_account_id fornecido mas NÃO é campanha!
[WhatsApp] 🚨 Detalhes: { whatsapp_account_id, campaign_id, message_type, store_id, phone }
[WhatsApp] 🚨 Mensagens normais DEVEM usar números principais. Ignorando whatsapp_account_id.
```

---

## ✅ Garantias

1. ✅ Mensagens normais (ponto, venda, ajuste, caixa, cashback, notificações) **NUNCA** usam números reserva
2. ✅ Números reserva **SOMENTE** para campanhas (`message_type === 'CAMPAIGN'`)
3. ✅ Instâncias sempre únicas (sufixo `_backup1`, `_backup2`, `_backup3`)
4. ✅ Tokens sempre atualizados quando N8N retorna novos valores
5. ✅ Logs detalhados para auditoria e debugging

---

## 🧪 Como Testar

### Teste 1: Mensagem Normal (deve usar número principal)
```javascript
// Chamar send-whatsapp-message SEM campaign_id
{
  phone: "5596981032928",
  message: "Teste ponto",
  store_id: "..."
  // SEM whatsapp_account_id, campaign_id, message_type
}
// ✅ Deve usar número principal ou global
```

### Teste 2: Campanha (pode usar número reserva)
```javascript
// Chamar send-whatsapp-message COM campaign_id e message_type
{
  phone: "5596981032928",
  message: "Oferta especial!",
  store_id: "...",
  whatsapp_account_id: "...",
  campaign_id: "...",
  message_type: "CAMPAIGN"
}
// ✅ Pode usar número reserva (se fornecido e conectado)
```

### Teste 3: Tentativa de Bypass (deve ser bloqueada)
```javascript
// Chamar send-whatsapp-message COM whatsapp_account_id mas SEM campanha válida
{
  phone: "5596981032928",
  message: "Teste ponto",
  store_id: "...",
  whatsapp_account_id: "..." // Tentativa de usar número reserva
  // SEM campaign_id ou message_type !== 'CAMPAIGN'
}
// 🚨 BLOQUEADO: whatsapp_account_id ignorado, usa número principal
```

---

## 📝 Notas Técnicas

- **Números principais:** Gerenciados em `whatsapp_credentials` (com `is_global = false`)
- **Números reserva:** Gerenciados em `whatsapp_accounts` (com `is_backup1`, `is_backup2`, `is_backup3`)
- **Número global:** Gerenciado em `whatsapp_credentials` (com `is_global = true`)
- **Fila:** `whatsapp_message_queue` armazena `campaign_id` e `message_type` para validação

---

**Última atualização:** 2025-12-20
**Status:** ✅ Proteções implementadas e testadas

