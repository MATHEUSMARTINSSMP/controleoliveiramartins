# ✅ PASSO A PASSO FINAL - Configuração Notificações de Ponto

## 📋 Status Atual
- ✅ Edge Function criada e corrigida (`process-time-clock-notifications/index.ts`)
- ✅ Migrações de RLS aplicadas
- ✅ Código commitado e enviado para o repositório
- ⚠️ **FALTA**: Deploy da Edge Function e configuração do Cron Job

---

## 🚀 O QUE PRECISA SER FEITO

### **PASSO 1: Deploy da Edge Function no Supabase**

1. **Acesse o Supabase Dashboard:**
   - Vá para: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc
   - Navegue até: **Edge Functions** → **Create a new function**

2. **Criar a função:**
   - Nome: `process-time-clock-notifications`
   - Cole o código do arquivo: `supabase/functions/process-time-clock-notifications/index.ts`

3. **OU use o CLI do Supabase:**
   ```bash
   # Se tiver o Supabase CLI instalado
   supabase functions deploy process-time-clock-notifications
   ```

4. **Verificar variáveis de ambiente:**
   - A Edge Function usa automaticamente:
     - `SUPABASE_URL` (já configurado)
     - `SUPABASE_SERVICE_ROLE_KEY` (já configurado)
   - **Não precisa configurar nada manualmente!**

---

### **PASSO 2: Configurar o Cron Job**

**Opção A: Via SQL Editor (RECOMENDADO)**

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Cole e execute o seguinte comando:

```sql
-- Remover job antigo se existir
SELECT cron.unschedule('process-time-clock-notifications') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
);

-- Criar novo job que chama a Edge Function
SELECT cron.schedule(
    'process-time-clock-notifications',
    '* * * * *',  -- A cada minuto
    $$
    SELECT
        net.http_post(
            url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s'
            ),
            body := '{}'::jsonb
        ) AS request_id;
    $$
);
```

3. **Verificar se foi criado:**
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

**Opção B: Via Supabase Dashboard (se disponível)**
- Vá em **Database** → **Cron Jobs** → **Create new job**
- Configure:
  - Name: `process-time-clock-notifications`
  - Schedule: `* * * * *` (a cada minuto)
  - SQL Command: (use o comando acima)

---

### **PASSO 3: Reativar Notificações Falhadas**

Execute no SQL Editor:

```sql
-- Reativar notificações que falharam com erro antigo
UPDATE sistemaretiradas.time_clock_notification_queue
SET status = 'PENDING',
    error_message = NULL,
    attempts = 0
WHERE status = 'FAILED'
AND error_message LIKE '%column "content" does not exist%'
AND attempts < 3;

-- Verificar quantas foram reativadas
SELECT COUNT(*) as reativadas
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING';
```

---

### **PASSO 4: Testar o Sistema**

1. **Verificar se a Edge Function está funcionando:**
   - Acesse: https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications
   - Deve retornar JSON com `success: true`

2. **Criar um registro de ponto de teste:**
   - Faça um registro de ponto no sistema
   - Verifique se a notificação foi criada na fila:
   ```sql
   SELECT * FROM sistemaretiradas.time_clock_notification_queue
   WHERE status = 'PENDING'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Aguardar 1-2 minutos** e verificar se foi processada:
   ```sql
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

4. **Verificar logs do cron job:**
   ```sql
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

---

## 🔍 VERIFICAÇÕES IMPORTANTES

### ✅ Checklist de Verificação

- [ ] Edge Function `process-time-clock-notifications` está deployada
- [ ] Cron job `process-time-clock-notifications` está criado e ativo
- [ ] Notificações falhadas foram reativadas
- [ ] Teste manual: criar registro de ponto e verificar envio
- [ ] Logs do cron job mostram execuções bem-sucedidas
- [ ] Notificações estão sendo enviadas via WhatsApp

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Problema: Edge Function retorna erro 500
**Solução:** Verifique se as variáveis de ambiente estão configuradas (devem estar automáticas)

### Problema: Cron job não executa
**Solução:** 
1. Verifique se `pg_net` está habilitado:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   -- Se não estiver, execute:
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```
2. Verifique se o job está ativo:
   ```sql
   SELECT active FROM cron.job WHERE jobname = 'process-time-clock-notifications';
   ```

### Problema: Notificações ficam em PENDING
**Solução:**
1. Verifique se a Netlify Function `send-whatsapp-message` está funcionando
2. Verifique se a URL da Netlify está correta em `app_config`:
   ```sql
   SELECT * FROM sistemaretiradas.app_config WHERE key = 'netlify_url';
   ```

### Problema: Erro "column content does not exist"
**Solução:** Este erro foi corrigido. Se ainda aparecer, significa que o cron job antigo ainda está rodando. Remova-o e crie o novo.

---

## 📝 COMANDOS ÚTEIS

Todos os comandos estão no arquivo: `COMANDOS_RAPIDOS_NOTIFICACOES_PONTO.sql`

---

## ✅ PRÓXIMOS PASSOS

1. **Deploy da Edge Function** (PASSO 1)
2. **Configurar Cron Job** (PASSO 2)
3. **Reativar notificações falhadas** (PASSO 3)
4. **Testar** (PASSO 4)

**Tempo estimado:** 10-15 minutos

---

## 📞 SUPORTE

Se algo não funcionar:
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Verifique os logs do cron job (comando SQL acima)
3. Verifique a fila de notificações (status, error_message)
4. Verifique se a Netlify Function está respondendo

