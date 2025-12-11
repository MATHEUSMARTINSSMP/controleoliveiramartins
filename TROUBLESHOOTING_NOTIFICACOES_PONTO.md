# 🔍 Troubleshooting: Notificações de Ponto Não Estão Funcionando

## Checklist de Verificação

### 1. ✅ Verificar se há itens na fila
Execute no Supabase SQL Editor:
```sql
SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM sistemaretiradas.time_clock_notification_queue;
```

**Se `pending = 0`**: O trigger pode não estar criando itens na fila.

**Se `pending > 0`**: Os itens estão na fila, mas não estão sendo processados.

### 2. ✅ Verificar Trigger
```sql
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_send_time_clock_notification';
```

**Se não encontrado ou `enabled = 'D'`**: O trigger está desabilitado ou não existe.

### 3. ✅ Verificar Cron Job
```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';
```

**Se `active = false`**: O cron job está inativo.

**Se não encontrado**: O cron job não existe.

### 4. ✅ Verificar Configurações de Notificação
```sql
SELECT 
    admin_id,
    notification_type,
    phone,
    store_id,
    active
FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'CONTROLE_PONTO'
AND active = true;
```

**Se vazio**: Não há destinatários configurados. Configure na aba "Ponto & Jornada" > "Notificações".

### 5. ✅ Verificar Configuração Principal
```sql
SELECT 
    store_id,
    notifications_enabled,
    use_global_whatsapp
FROM sistemaretiradas.time_clock_notification_config;
```

**Se `notifications_enabled = false`**: As notificações estão desabilitadas para esta loja.

### 6. ✅ Verificar Edge Function
1. Acesse: Supabase Dashboard > Edge Functions
2. Verifique se `process-time-clock-notifications` existe
3. Verifique os logs da Edge Function

### 7. ✅ Verificar se itens estão sendo criados
Execute após um registro de ponto:
```sql
SELECT 
    id,
    time_clock_record_id,
    phone,
    status,
    created_at,
    error_message
FROM sistemaretiradas.time_clock_notification_queue
ORDER BY created_at DESC
LIMIT 5;
```

## Problemas Comuns e Soluções

### ❌ Problema 1: Trigger não cria itens na fila

**Causa**: Trigger desabilitado ou configurações de notificação não encontradas.

**Solução**:
```sql
-- Verificar se trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'trigger_send_time_clock_notification';

-- Recriar trigger se necessário
DROP TRIGGER IF EXISTS trigger_send_time_clock_notification ON sistemaretiradas.time_clock_records;
CREATE TRIGGER trigger_send_time_clock_notification
    AFTER INSERT ON sistemaretiradas.time_clock_records
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.send_time_clock_notification();
```

### ❌ Problema 2: Cron Job não está ativo

**Causa**: Cron job desabilitado ou não existe.

**Solução**:
```sql
-- Verificar se existe
SELECT * FROM cron.job WHERE jobname = 'process-time-clock-notifications';

-- Se existir mas estiver inativo, ativar manualmente (via Dashboard ou SQL)
UPDATE cron.job 
SET active = true 
WHERE jobname = 'process-time-clock-notifications';

-- Se não existir, criar:
DO $$
BEGIN
    PERFORM cron.schedule(
        'process-time-clock-notifications',
        '* * * * *',  -- A cada minuto
        $$
        SELECT
            net.http_post(
                url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json'
                ),
                body := '{}'::jsonb
            ) AS request_id;
        $$
    );
END $$;
```

### ❌ Problema 3: Não há destinatários configurados

**Causa**: Números de telefone não foram adicionados na configuração.

**Solução**:
1. Acesse: Admin Dashboard > Gestão de Pessoas > Ponto & Jornada > Notificações
2. Ative as notificações
3. Adicione números de telefone dos destinatários
4. Salve a configuração

### ❌ Problema 4: Edge Function não está sendo chamada

**Causa**: Cron job não está chamando a Edge Function ou há erro na Edge Function.

**Solução**:
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Teste manualmente chamando a Edge Function:
   ```bash
   curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications \
     -H "Authorization: Bearer [SEU_SERVICE_ROLE_KEY]"
   ```

### ❌ Problema 5: Itens na fila mas não são processados

**Causa**: Edge Function não está sendo executada ou está falhando silenciosamente.

**Solução**:
1. Verifique logs da Edge Function
2. Verifique se há erros nos itens da fila:
   ```sql
   SELECT 
       id,
       phone,
       status,
       error_message,
       attempts
   FROM sistemaretiradas.time_clock_notification_queue
   WHERE status = 'FAILED'
   ORDER BY created_at DESC;
   ```

## Teste Completo

1. **Registrar um ponto** (como colaboradora)
2. **Verificar se item foi criado na fila**:
   ```sql
   SELECT * FROM sistemaretiradas.time_clock_notification_queue 
   ORDER BY created_at DESC LIMIT 1;
   ```
3. **Aguardar 1-2 minutos** (cron job roda a cada minuto)
4. **Verificar se item foi processado**:
   ```sql
   SELECT status, sent_at, error_message 
   FROM sistemaretiradas.time_clock_notification_queue 
   ORDER BY created_at DESC LIMIT 1;
   ```
5. **Verificar logs da Edge Function** no Supabase Dashboard

## Script de Diagnóstico Completo

Execute o arquivo `DIAGNOSTICAR_NOTIFICACOES_PONTO.sql` para verificar todos os pontos acima de uma vez.

