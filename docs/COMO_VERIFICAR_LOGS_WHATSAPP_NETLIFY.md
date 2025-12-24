# 📊 Como Verificar Logs do WhatsApp no Netlify

## 🎯 Problema Identificado

Mensagens estão sendo marcadas como `SENT` mas não estão chegando. As mensagens antigas não têm a resposta do N8N salva no metadata porque foram enviadas antes da correção.

## 🔍 Como Acessar os Logs

### 1. Acesse o Netlify Dashboard

```
https://app.netlify.com/
```

### 2. Selecione o Site

- Escolha o site `eleveaone` (ou o nome do seu site)

### 3. Vá em Functions

- No menu lateral, clique em **"Functions"**
- Ou acesse diretamente: `https://app.netlify.com/sites/[SEU_SITE_ID]/functions`

### 4. Selecione a Função

Você precisa verificar **DUAS** funções:

#### A) `process-whatsapp-queue`
- Esta função processa a fila de mensagens
- Procure por logs com: `[ProcessWhatsAppQueue] Resposta do send-whatsapp-message`

#### B) `send-whatsapp-message`
- Esta função envia a mensagem para o N8N
- Procure por logs com: `[WhatsApp] Resposta completa do N8N`

## 🔎 O Que Procurar nos Logs

### Para Mensagens Específicas

Use o ID da mensagem para buscar nos logs. Exemplo:
- ID: `f39af50f-b1c7-4580-a793-68534d17fd79`
- Busque por: `f39af50f` ou `68534d17fd79`

### Logs Importantes

#### 1. Resposta do N8N
```
[WhatsApp] Resposta completa do N8N: {
  "success": true/false,
  "error": "...",
  "message": "...",
  "status": "..."
}
```

#### 2. Validação da Resposta
```
[WhatsApp] ✅ Mensagem enviada com sucesso (validado)
```
ou
```
[WhatsApp] ❌ Erro na resposta do N8N: ...
```

#### 3. Processamento da Fila
```
[ProcessWhatsAppQueue] Resposta do send-whatsapp-message para [ID]: {
  "success": true/false,
  ...
}
```

## 📋 Exemplo de Investigação

### Para a mensagem: `f39af50f-b1c7-4580-a793-68534d17fd79`

1. **Acesse os logs do `send-whatsapp-message`**
2. **Filtre por data/hora**: `2025-12-24 12:53:04` (created_at)
3. **Procure por**: 
   - `[WhatsApp] Resposta completa do N8N`
   - `f39af50f` (ID da mensagem)
   - `96981032928` (telefone)

4. **Verifique**:
   - Se o N8N retornou `success: false`
   - Se há `error` na resposta
   - Se o status é `error` ou `failed`

## 🚨 Possíveis Problemas Encontrados

### 1. N8N Retorna HTTP 200 mas com `success: false`
**Solução**: A validação rigorosa agora detecta isso e marca como falha

### 2. N8N Retorna Sucesso mas Mensagem Não Chega
**Possíveis causas**:
- Problema no webhook do N8N
- Número bloqueado no WhatsApp
- Instância do UazAPI desconectada momentaneamente
- Rate limiting do WhatsApp

### 3. Timeout na Requisição
**Solução**: Timeout aumentado para 15 segundos

## 📊 Queries SQL para Ajudar

Execute estas queries para identificar mensagens problemáticas:

```sql
-- Mensagens SENT sem resposta do N8N salva
SELECT * FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'SENT'
AND metadata->'n8n_response' IS NULL
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

## ✅ Próximos Passos

1. **Verifique os logs** do Netlify para essas mensagens
2. **Identifique o padrão**: O que o N8N está retornando?
3. **Compartilhe os resultados** para ajustar a validação se necessário

## 🔄 Mensagens Futuras

A partir de agora, todas as mensagens terão:
- ✅ Resposta do N8N salva no metadata
- ✅ Validação rigorosa antes de marcar como SENT
- ✅ Logs detalhados para debug

