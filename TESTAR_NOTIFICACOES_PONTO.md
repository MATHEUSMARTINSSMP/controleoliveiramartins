# ✅ TESTE: Notificações de Ponto

## Status Atual
- ✅ pg_net habilitado
- ✅ Cron job criado e ativo (jobid: 57)
- ✅ Executando a cada minuto

## Próximos Passos para Testar

### 1. Verificar se a Edge Function está deployada

Acesse no Supabase Dashboard:
- **Edge Functions** → Verifique se `process-time-clock-notifications` está listada
- Se não estiver, faça o deploy:
  ```bash
  supabase functions deploy process-time-clock-notifications
  ```

### 2. Testar a Edge Function manualmente

Execute no SQL Editor:
```sql
-- Testar chamada direta da Edge Function
SELECT
    net.http_post(
        url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) AS request_id;
```

### 3. Verificar notificações pendentes

```sql
-- Ver notificações pendentes na fila
SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at,
    sent_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10;
```

### 4. Criar um registro de ponto de teste

1. Acesse o sistema
2. Faça um registro de ponto (entrada ou saída)
3. Verifique se a notificação foi adicionada à fila:
   ```sql
   SELECT * FROM sistemaretiradas.time_clock_notification_queue
   WHERE status = 'PENDING'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

### 5. Aguardar 1-2 minutos e verificar se foi processada

```sql
-- Verificar se a notificação foi enviada
SELECT 
    id,
    status,
    attempts,
    error_message,
    sent_at,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
ORDER BY created_at DESC
LIMIT 10;
```

### 6. Verificar logs do cron job

```sql
-- Ver últimas execuções do cron job
SELECT 
    runid,
    jobid,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
WHERE jobid = 57
ORDER BY start_time DESC
LIMIT 10;
```

### 7. Verificar estatísticas

```sql
-- Estatísticas das últimas 24 horas
SELECT 
    status,
    COUNT(*) as total,
    MIN(created_at) as primeira,
    MAX(created_at) as ultima
FROM sistemaretiradas.time_clock_notification_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;
```

## ✅ Checklist de Verificação

- [ ] Edge Function está deployada
- [ ] Teste manual da Edge Function retorna sucesso
- [ ] Registro de ponto cria notificação na fila
- [ ] Cron job executa (verificar logs)
- [ ] Notificações são processadas (status muda de PENDING para SENT)
- [ ] WhatsApp recebe as mensagens

## 🐛 Problemas Comuns

### Edge Function retorna erro 404
**Solução:** A Edge Function não está deployada. Faça o deploy.

### Notificações ficam em PENDING
**Solução:** 
1. Verifique se a Netlify Function `send-whatsapp-message` está funcionando
2. Verifique se a URL do Netlify está correta em `app_config`:
   ```sql
   SELECT * FROM sistemaretiradas.app_config WHERE key = 'netlify_url';
   ```

### Cron job não executa
**Solução:**
1. Verifique se está ativo: `SELECT active FROM cron.job WHERE jobid = 57;`
2. Verifique os logs de execução (comando acima)

### Erro "JWT failed verification"
**Solução:** Já foi corrigido removendo o header Authorization e configurando `verify_jwt = false` no `config.toml`

