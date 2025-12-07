# Corrigir Loop de Webhook WhatsApp - N8N

## Problema
O webhook de conexão do UazAPI está sendo processado em loop infinito:
```
[WebsocketsIn] Conexão estabelecida: Parameter polling...
[WebsocketsIn] Status verificado: connected status watermark: unconfirmed
```

## Causa Raiz
O webhook de conexão (`is_connection_event: true`) provavelmente está:
1. ❌ Fazendo múltiplas requisições de volta para UazAPI
2. ❌ Não retornando status 200 imediatamente
3. ❌ Reenviando dados que causam o webhook disparar novamente

## Solução no N8N

### 1️⃣ Fluxo Simplificado do Webhook de Conexão

```
Webhook UazAPI (connection event)
    ↓
[Condition] is_connection_event = true?
    ↓ SIM
[If] Skip Chatwoot & Save Only
    ↓
[PostgreSQL] INSERT/UPDATE whatsapp_credentials ONLY
    ↓
[Respond to Webhook] Status 200 + Sucesso
    ↓
[END - NÃO faça mais nada]
```

### 2️⃣ Configuração do Webhook Response

**CRÍTICO**: Após salvar as credenciais:

```json
{
  "status": "success",
  "message": "Credenciais salvas",
  "skip_notification": true,
  "skip_chatwoot": true
}
```

**Não retorne:**
- ❌ `instance_metadata` (pode disparar novamente)
- ❌ Dados para Chatwoot
- ❌ Qualquer comando para UazAPI

### 3️⃣ Checklist do Fluxo N8N

Para **Webhook de Conexão** (`is_connection_event: true`):

- [ ] Condition: `if (is_connection_event === true)`
- [ ] Apenas UM nó PostgreSQL INSERT/UPDATE
- [ ] Sem transformação/normalization adicional
- [ ] Resposta imediata HTTP 200
- [ ] **Nenhuma outra ação após resposta**

### 4️⃣ HTTP Response Node

Configure o nó de resposta HTTP assim:

```
Headers: {
  "Content-Type": "application/json"
}

Body: {
  "ok": true,
  "processed": true,
  "skip_webhook_retry": true
}

Status Code: 200
```

### 5️⃣ Remover Conexões Cíclicas

Se há algum nó que está:
- Enviando para webhook N8N novamente
- Atualizando dados que re-disparam o webhook
- Chamando UazAPI API

**REMOVA-O** do fluxo de conexão.

---

## Por Que Está em Loop?

O UazAPI envia:
1. Evento de conexão com status `connecting`
2. N8N processa e salva
3. Se a resposta não for 200 ou se fizer algo adicional
4. UazAPI reenvia o evento
5. Loop continua

## Status Esperados

```
connecting → N8N salva → [STOP]
            ↓
            200 OK (não reenvia)
            
✅ Correto: N8N recebe, salva credenciais, retorna 200, PARA

❌ Errado: N8N recebe, salva, envia para Chatwoot, Chatwoot reenvia, loop infinito
```

---

## Próximos Passos

1. Abra o fluxo do webhook no N8N
2. Procure pelo nó que processa `is_connection_event = true`
3. Remova TODOS os nós após o INSERT/UPDATE (exceto Response)
4. Teste enviando um evento de conexão novamente
5. Verifique se aparecer apenas UMA vez no console

