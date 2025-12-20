# Investigação: Mensagens não estão chegando

## Problema
- ✅ Mensagens são inseridas na fila com sucesso
- ❌ Mensagens não chegam ao destinatário
- Logs mostram criação mas não há envio

## Fluxo Esperado

1. **Frontend** → Cria campanha e insere mensagens em `whatsapp_message_queue` (status: `PENDING`)
2. **Cron Job ou Função** → Chama `process-whatsapp-queue` periodicamente
3. **process-whatsapp-queue** → 
   - Busca próximas mensagens via `get_next_whatsapp_messages()`
   - Para cada mensagem:
     - Marca como `SENDING`
     - Chama `send-whatsapp-message` (Netlify Function)
     - Atualiza status para `SENT` ou `FAILED`
4. **send-whatsapp-message** → Envia via UazAPI/N8N

## Possíveis Problemas

### 1. ❓ Process-whatsapp-queue não está sendo executado
- Não há cron job configurado?
- Netlify Cron não está configurado?
- Função não está sendo chamada manualmente?

### 2. ❓ Função get_next_whatsapp_messages não retorna mensagens
- Filtros muito restritivos (horário, agendamento)?
- Status incorreto?
- Prioridade incorreta?

### 3. ❓ Erro no envio que não está sendo logado
- Função `send-whatsapp-message` falhando silenciosamente?
- Credenciais WhatsApp inválidas?
- Número WhatsApp não conectado?

## Ações de Investigação

### Passo 1: Verificar Status na Fila
```sql
-- Executar: INVESTIGAR_ENVIO_WHATSAPP.sql
-- Verificar se mensagens estão com status PENDING/SCHEDULED
```

### Passo 2: Verificar Cron Jobs
```sql
-- Verificar se há cron job configurado em Supabase
SELECT * FROM cron.job WHERE command LIKE '%whatsapp%';
```

### Passo 3: Verificar Netlify Cron
```bash
# Verificar netlify.toml para cron jobs
cat netlify.toml | grep -i cron
```

### Passo 4: Testar Função Manualmente
```bash
# Chamar process-whatsapp-queue manualmente
curl -X POST https://eleveaone.com.br/.netlify/functions/process-whatsapp-queue
```

### Passo 5: Verificar Logs Netlify
- Ver logs da função `process-whatsapp-queue` no Netlify
- Ver logs da função `send-whatsapp-message` no Netlify

## Próximos Passos

1. Executar `INVESTIGAR_ENVIO_WHATSAPP.sql` no Supabase
2. Verificar se há cron job configurado
3. Verificar `netlify.toml` para cron
4. Testar função manualmente
5. Verificar logs no Netlify

