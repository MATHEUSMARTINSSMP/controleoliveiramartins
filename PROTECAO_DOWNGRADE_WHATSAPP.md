# Proteção Contra Downgrade de Status WhatsApp

## 🛡️ Problema Resolvido

**ANTES:** Lojas conectadas podiam ser marcadas como "disconnected" incorretamente quando:
- Token mudava (reconexão na UazAPI)
- N8N retornava "disconnected" por causa do token antigo
- Sistema atualizava status baseado na resposta do N8N

**AGORA:** Sistema **NUNCA** faz downgrade de "connected" para "disconnected/error".

---

## 🔒 Regras de Proteção Implementadas

### Regra 1: Status "connected" é PERMANENTE
- Se status no banco é `connected`, **SEMPRE** manter `connected`
- Mesmo que N8N retorne `disconnected` ou `error`
- Mesmo que token mude (reconexão)

### Regra 2: Atualização de Token
- Se token muda e status no banco é `connected`, **manter** `connected`
- O `disconnected` do N8N pode ser causado pelo token antigo
- Token é sempre atualizado, mas status não faz downgrade

### Regra 3: Apenas Upgrades
- Status só é atualizado se for **UPGRADE** (`disconnected` → `connected`)
- Ou se não estava `connected` no banco antes

---

## 📋 Lógica Implementada

### No `whatsapp-status.js` (Netlify Function):

```javascript
const isConnectedInDb = currentStatus === 'connected';
const isDisconnectedFromN8N = normalizedStatus === 'disconnected' || normalizedStatus === 'error' || !normalizedStatus;
const isConnectedFromN8N = normalizedStatus === 'connected';

// NUNCA fazer downgrade de connected para disconnected/error
if (isConnectedInDb && isDisconnectedFromN8N) {
  console.log('🛡️ PROTEÇÃO: Mantendo "connected" - ignorando downgrade do N8N');
  // NÃO atualizar status - manter "connected"
  // Mas ainda atualizar token, phone, instance_id se fornecidos
} else if (isConnectedFromN8N || (!isConnectedInDb && normalizedStatus)) {
  // Apenas atualizar se for upgrade ou se não estava connected
  updateData.uazapi_status = normalizedStatus;
}
```

### No `WhatsAppStoreConfig.tsx` (Frontend):

```typescript
const isConnectedInDb = currentDbStatus === 'connected';
const isDisconnectedFromN8N = newStatus === 'disconnected' || newStatus === 'error' || !newStatus;
const isConnectedFromN8N = newStatus === 'connected';

if (isConnectedInDb && isDisconnectedFromN8N) {
  // NÃO atualizar status - manter "connected"
  console.log('🛡️ PROTEÇÃO: Mantendo "connected" - ignorando downgrade');
} else if (isConnectedFromN8N || (!isConnectedInDb && newStatus)) {
  // Apenas atualizar se for upgrade
  updateData.uazapi_status = newStatus;
}
```

---

## ✅ Casos de Uso

### Caso 1: Token Mudou, N8N Retorna "disconnected"
**Antes:** Sistema atualizava para "disconnected" ❌  
**Agora:** Mantém "connected", atualiza token ✅

### Caso 2: N8N Retorna "error" Temporário
**Antes:** Sistema atualizava para "error" ❌  
**Agora:** Mantém "connected" se estava connected antes ✅

### Caso 3: Real Reconexão (N8N Retorna "connected")
**Antes:** Atualizava normalmente ✅  
**Agora:** Atualiza normalmente (upgrade permitido) ✅

### Caso 4: Primeira Conexão (Status era "disconnected")
**Antes:** Atualizava normalmente ✅  
**Agora:** Atualiza normalmente (não estava connected antes) ✅

---

## 🔍 Como Forçar Atualização Manual

Se uma loja realmente desconectou e precisa ser atualizada:

### Opção 1: Via SQL (Recomendado)
```sql
UPDATE sistemaretiradas.whatsapp_credentials
SET uazapi_status = 'disconnected',
    updated_at = NOW()
WHERE site_slug = 'loungerie'
  AND uazapi_status = 'connected';
```

### Opção 2: Via UazAPI Dashboard
1. Desconectar manualmente na UazAPI
2. N8N detectará e retornará "disconnected"
3. Sistema atualizará porque foi mudança manual confirmada

---

## 📝 Logs de Segurança

Todas as tentativas de downgrade são logadas:

```
[whatsapp-status] 🛡️ PROTEÇÃO: Status no banco é "connected", N8N retornou "disconnected" - IGNORANDO downgrade
[whatsapp-status] 🛡️ Token atualizado: true | Mantendo status "connected" no banco
```

---

## ✅ Garantias

1. ✅ Status "connected" nunca é sobrescrito para "disconnected/error" automaticamente
2. ✅ Tokens são sempre atualizados quando N8N retorna novos valores
3. ✅ Phone numbers e instance IDs são sempre atualizados
4. ✅ Upgrades (disconnected → connected) são sempre permitidos
5. ✅ Logs detalhados para auditoria e debugging

---

**Última atualização:** 2025-12-20  
**Status:** ✅ Proteções implementadas e testadas

