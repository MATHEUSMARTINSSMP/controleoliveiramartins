# PARAR LOOP WEBHOOK N8N - AÇÕES IMEDIATAS

## 🚨 Problema Atual
O webhook de conexão do UazAPI está sendo disparado múltiplas vezes, causando múltiplas execuções no N8N e travando o frontend.

---

## ✅ Solução Rápida (Faça Agora)

### 1️⃣ NO N8N - Desabilitar Webhook Temporariamente

1. Abra o fluxo **"WHATSAPP - Auth Disconnect"** ou **"WhatsApp - Connection Event"**
2. Procure pelo nó **"Webhook"** (o primeiro nó que recebe eventos do UazAPI)
3. Clique no nó e vá para **"Settings"**
4. Desabilite o webhook:
   - [ ] **Checkbox "Active"** - DESMARCAR
   - [ ] **Salvar** (Ctrl+S ou Cmd+S)

### 2️⃣ Testa a Página de Admin
- Abre: `/admin/whatsapp-config`
- Verifica se a interface volta a responder normalmente
- Se SIM → Problema resolvido temporariamente

---

## 🔧 Solução Permanente

### Passo 1: Ajustar o Webhook para NÃO RE-PROCESSAR

No fluxo N8N, adicione uma **Condition** após o webhook de conexão:

```
Webhook IN
  ↓
[Condition] is_connection_event = true?
  ↓ SIM
  [PostgreSQL] INSERT/UPDATE whatsapp_credentials ONLY
  ↓
  [HTTP Response] 200 OK + { "ok": true }
  ↓
  [STOP - NÃO continue]

  ↓ NÃO (mensagem normal)
  [Continue fluxo normal...]
```

### Passo 2: Remover Qualquer Re-envio

Procure por nós que estão:
- ❌ Enviando para outro webhook
- ❌ Chamando uma função Netlify
- ❌ Reenviando para UazAPI

**SE ENCONTRAR QUALQUER UM DESSES** no caminho do connection event:
- **DELETA-O** ou
- **CRIA UM NOVO FLUXO SEPARADO** para connection events

### Passo 3: Garantir Resposta Imediata

O último nó do fluxo de connection event deve ser:

```
HTTP Response Node
  Status Code: 200
  Headers: Content-Type: application/json
  Body: { "ok": true, "skip_retry": true }
```

---

## 📋 Checklist Final

- [ ] Webhook desabilitado temporariamente
- [ ] Frontend voltou a responder
- [ ] N8N ajustado para: connection event → INSERT → 200 OK → STOP
- [ ] Nenhum nó de re-envio no fluxo de conexão
- [ ] HTTP Response configurada com status 200
- [ ] Webhook reabilitado
- [ ] Testado novamente (apenas 1 execução no N8N)

---

## 🚀 Depois de Resolver

1. Webhook N8N funcionando sem loop
2. Frontend respondendo normalmente
3. Credenciais sendo salvas corretamente
4. Status aparecendo como "Conectando" → "Conectado"

