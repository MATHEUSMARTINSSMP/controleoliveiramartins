# ✅ RESUMO COMPLETO: Configuração de Notificações de Ponto

## 📝 CHECKLIST RÁPIDO

- [ ] Aplicar migrações SQL (já devem estar aplicadas)
- [ ] Fazer deploy da Edge Function
- [ ] Configurar cron job no Supabase
- [ ] Reativar notificações falhadas
- [ ] Testar o sistema

---

## 🚀 PASSO 1: Deploy da Edge Function

### Opção A: Via Supabase Dashboard (Mais Fácil)

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions

2. Clique em **"Create a new function"**

3. Configure:
   - **Nome**: `process-time-clock-notifications`
   - **Descrição**: `Processa fila de notificações de ponto`

4. Abra o arquivo `supabase/functions/process-time-clock-notifications/index.ts` e copie TODO o conteúdo

5. Cole no editor do Dashboard

6. Clique em **"Deploy"**

### Opção B: Via CLI (Terminal)

```bash
cd /home/matheusmartins/controleoliveiramartins-1
supabase login
supabase link --project-ref kktsbnrnlnzyofupegjc
supabase functions deploy process-time-clock-notifications
```

---

## ⚙️ PASSO 2: Configurar Cron Job

1. **Acesse o SQL Editor do Supabase**:
   https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new

2. **Cole e execute este comando completo**:

```sql
-- Remover job antigo se existir
SELECT cron.unschedule('process-time-clock-notifications') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
);

-- Criar novo job que chama a Edge Function via HTTP
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

-- Verificar se foi criado
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname = 'process-time-clock-notifications';
```

3. **Verifique se retornou** `active = true`

---

## 🔄 PASSO 3: Reativar Notificações Falhadas

No mesmo SQL Editor, execute:

```sql
-- Reativar notificações falhadas pelo erro antigo
UPDATE sistemaretiradas.time_clock_notification_queue
SET status = 'PENDING',
    error_message = NULL,
    attempts = 0
WHERE status = 'FAILED'
AND error_message LIKE '%column "content" does not exist%'
AND attempts < 3;

-- Verificar quantas foram reativadas
SELECT COUNT(*) as notificacoes_reativadas
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING';
```

---

## 🧪 PASSO 4: Testar

### Teste 1: Testar Edge Function manualmente

No terminal:

```bash
curl -X POST 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Ou use o script**:
```bash
./TESTE_EDGE_FUNCTION.sh
```

### Teste 2: Verificar notificações pendentes

```sql
SELECT 
    id,
    phone,
    status,
    attempts,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 5;
```

### Teste 3: Verificar se foram processadas

```sql
SELECT 
    status,
    COUNT(*) as total
FROM sistemaretiradas.time_clock_notification_queue
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY status;
```

---

## 📊 MONITORAMENTO

### Ver logs da Edge Function:
1. Dashboard → Edge Functions → `process-time-clock-notifications` → **Logs**

### Ver execuções do cron job:
```sql
SELECT 
    runid,
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

### Ver estatísticas:
```sql
SELECT 
    status,
    COUNT(*) as total,
    MIN(created_at) as primeira,
    MAX(created_at) as ultima
FROM sistemaretiradas.time_clock_notification_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## ✅ VERIFICAÇÃO FINAL

Execute este comando para verificar se tudo está configurado:

```sql
-- Verificar se o cron job existe e está ativo
SELECT 
    'Cron Job' as tipo,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname = 'process-time-clock-notifications'

UNION ALL

-- Verificar se há notificações pendentes
SELECT 
    'Notificações Pendentes' as tipo,
    COUNT(*)::text as schedule,
    NULL::boolean as active
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'

UNION ALL

-- Verificar configurações ativas
SELECT 
    'Configs Ativas' as tipo,
    COUNT(*)::text as schedule,
    NULL::boolean as active
FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'CONTROLE_PONTO'
AND active = true;
```

**Resultado esperado**:
- Cron Job: `active = true`
- Notificações Pendentes: número (pode ser 0)
- Configs Ativas: pelo menos 1

---

## 🎯 TESTE FINAL

1. **Faça um registro de ponto** no sistema
2. **Aguarde 1-2 minutos**
3. **Verifique se a mensagem WhatsApp foi enviada**
4. **Verifique os logs** no Dashboard → Edge Functions → Logs

---

## 🐛 PROBLEMAS COMUNS

### ❌ Erro: "pg_net não está habilitado"
**Solução**: 
1. Dashboard → Database → Extensions
2. Procure `pg_net`
3. Clique em **"Enable"**

### ❌ Erro: "Edge Function não encontrada"
**Solução**: Verifique se fez o deploy corretamente (Passo 1)

### ❌ Erro: "Unauthorized"
**Solução**: Verifique se o SERVICE_ROLE_KEY está correto no cron job

### ❌ Notificações não estão sendo enviadas
**Solução**: 
1. Verifique os logs da Edge Function
2. Verifique se há itens `PENDING` na fila
3. Verifique se as configurações de notificação estão ativas (última query SQL)

---

## 📞 LINKS ÚTEIS

- **Supabase Dashboard**: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc
- **SQL Editor**: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new
- **Edge Functions**: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
- **Logs**: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/logs/edge-functions

---

**🎉 Pronto! O sistema de notificações de ponto está configurado!**

Se precisar de ajuda, consulte os arquivos detalhados:
- `TUTORIAL_NOTIFICACOES_PONTO.md` - Tutorial completo passo a passo
- `COMANDOS_RAPIDOS_NOTIFICACOES_PONTO.sql` - Todos os comandos SQL
- `DEPLOY_EDGE_FUNCTION.md` - Guia de deploy detalhado

