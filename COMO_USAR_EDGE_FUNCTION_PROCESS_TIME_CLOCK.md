# Como Usar a Edge Function process-time-clock-notifications

## ⚠️ IMPORTANTE: NÃO execute código TypeScript no SQL Editor!

O código TypeScript da Edge Function está localizado em:
```
supabase/functions/process-time-clock-notifications/index.ts
```

**Este arquivo NÃO deve ser executado no SQL Editor do Supabase!**

## Como a Edge Function funciona

1. **O código TypeScript** (`index.ts`) roda no ambiente Deno do Supabase
2. **A Edge Function é chamada via HTTP** ou pelo cron job configurado
3. **NÃO é executada via SQL**

## Como configurar o cron job

### Opção 1: Via SQL (usando pg_net)

Execute o arquivo `COMANDOS_RAPIDOS_NOTIFICACOES_PONTO.sql` no SQL Editor:

```sql
SELECT cron.schedule(
    'process-time-clock-notifications',
    '* * * * *',  -- A cada minuto
    $$
    SELECT
        net.http_post(
            url := 'https://[seu-projeto].supabase.co/functions/v1/process-time-clock-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);
```

### Opção 2: Via Supabase Dashboard

1. Vá para **Database > Cron Jobs**
2. Clique em **New Cron Job**
3. Configure:
   - **Name**: `process-time-clock-notifications`
   - **Schedule**: `* * * * *` (a cada minuto)
   - **URL**: `https://[seu-projeto].supabase.co/functions/v1/process-time-clock-notifications`
   - **Method**: `POST`
   - **Headers**: 
     - `Authorization: Bearer [SERVICE_ROLE_KEY]`
     - `Content-Type: application/json`
   - **Body**: `{}`

## Como testar manualmente

### Via cURL:
```bash
curl -X POST https://[seu-projeto].supabase.co/functions/v1/process-time-clock-notifications \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Via Supabase Dashboard:
1. Vá para **Edge Functions**
2. Encontre `process-time-clock-notifications`
3. Clique em **Invoke**
4. Use o método POST com body vazio `{}`

## Verificar se está funcionando

Execute no SQL Editor:

```sql
-- Ver notificações pendentes
SELECT 
    id,
    phone,
    status,
    attempts,
    error_message,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10;

-- Ver últimas execuções do cron job
SELECT 
    runid,
    jobid,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
WHERE jobid IN (
    SELECT jobid FROM cron.job WHERE jobname = 'process-time-clock-notifications'
)
ORDER BY start_time DESC
LIMIT 10;
```

## Resumo

✅ **FAÇA**: Execute SQL no SQL Editor  
✅ **FAÇA**: Configure cron jobs via SQL ou Dashboard  
✅ **FAÇA**: Chame Edge Functions via HTTP  

❌ **NÃO FAÇA**: Execute código TypeScript no SQL Editor  
❌ **NÃO FAÇA**: Tente criar funções SQL com código TypeScript  

