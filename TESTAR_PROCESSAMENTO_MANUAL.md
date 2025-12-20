# Testar Processamento Manual da Fila

## Status Atual
- ✅ Mensagem inserida na fila com sucesso (status: PENDING)
- ❌ Mensagem não está sendo processada automaticamente
- ❓ Cron job pode não estar configurado ou funcionando

## Testes Manuais

### 1. Testar Função get_next_whatsapp_messages (SQL)
```sql
-- Ver se a função retorna a mensagem pendente
SELECT * FROM sistemaretiradas.get_next_whatsapp_messages(10);
```

**Esperado**: Deve retornar a mensagem com `phone: "(96) 98111-3307"`

---

### 2. Chamar process-whatsapp-queue Manualmente (cURL)
```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-whatsapp-queue \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Esperado**: 
```json
{
  "success": true,
  "processed": 1,
  "failed": 0,
  "skipped": 0
}
```

---

### 3. Verificar Logs no Netlify
1. Ir em: https://app.netlify.com/sites/eleveaone/functions
2. Clicar em `process-whatsapp-queue`
3. Ver logs da última execução

**Procurar por**:
- `[ProcessWhatsAppQueue] 🔄 Iniciando processamento da fila...`
- `[ProcessWhatsAppQueue] 📋 X mensagem(ns) encontrada(s) na fila`
- `[ProcessWhatsAppQueue] ✅ Mensagem X enviada com sucesso`

---

### 4. Verificar Status Após Teste Manual
```sql
-- Verificar se status mudou para SENT
SELECT 
    id,
    phone,
    status,
    sent_at,
    error_message,
    retry_count,
    updated_at
FROM sistemaretiradas.whatsapp_message_queue
WHERE id = 'd20e50a7-e433-4a1e-80ff-32e3b175d3f4';
```

**Esperado**: `status = 'SENT'` e `sent_at` preenchido

---

### 5. Verificar Cron Job (se configurado)
```sql
-- Ver se cron job existe
SELECT * FROM cron.job WHERE jobname = 'processar-fila-whatsapp-unificada';

-- Ver logs do cron job
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'processar-fila-whatsapp-unificada')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Se get_next_whatsapp_messages NÃO retornar a mensagem

Verificar:
1. **Horário**: A função pode estar filtrando por janela de horário
2. **Agendamento**: Pode estar aguardando `scheduled_for`
3. **Prioridade**: Pode estar com prioridade incorreta

Teste direto:
```sql
-- Buscar mensagem diretamente na tabela
SELECT 
    id,
    status,
    priority,
    scheduled_for,
    allowed_start_hour,
    allowed_end_hour,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Belem') as hora_atual
FROM sistemaretiradas.whatsapp_message_queue
WHERE id = 'd20e50a7-e433-4a1e-80ff-32e3b175d3f4';
```

---

## Se process-whatsapp-queue retornar erro

Verificar logs no Netlify para ver o erro específico.

Possíveis problemas:
- Erro ao buscar credenciais WhatsApp
- Número WhatsApp não conectado
- Erro na chamada para send-whatsapp-message
- Timeout da função

