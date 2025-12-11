# 🚀 TUTORIAL COMPLETO: Configurar Notificações de Ponto

Este tutorial guia você através de todo o processo de configuração das notificações de ponto, desde o deploy da Edge Function até a configuração do cron job.

---

## 📋 PRÉ-REQUISITOS

- Acesso ao Supabase Dashboard
- CLI do Supabase instalado (opcional, mas recomendado)
- As migrações SQL já aplicadas no banco de dados

---

## 🔧 PASSO 1: Fazer Deploy da Edge Function

### Opção A: Usando Supabase CLI (Recomendado)

1. **Instalar Supabase CLI** (se ainda não tiver):
```bash
npm install -g supabase
```

2. **Login no Supabase**:
```bash
supabase login
```

3. **Linkar ao projeto**:
```bash
supabase link --project-ref kktsbnrnlnzyofupegjc
```
(Use o project-ref que aparece na URL: `https://kktsbnrnlnzyofupegjc.supabase.co`)

4. **Fazer deploy da função**:
```bash
supabase functions deploy process-time-clock-notifications
```

### Opção B: Via Supabase Dashboard (Web)

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
2. Clique em **"Create a new function"**
3. Nome: `process-time-clock-notifications`
4. Cole o conteúdo do arquivo `supabase/functions/process-time-clock-notifications/index.ts`
5. Clique em **"Deploy"**

---

## ⚙️ PASSO 2: Configurar Cron Job no Supabase Dashboard

1. **Acesse o Supabase Dashboard**:
   - URL: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/database/extensions
   - Ou: Dashboard → Database → Extensions

2. **Verificar se `pg_cron` está habilitado**:
   - Procure por `pg_cron` na lista de extensões
   - Se não estiver habilitado, clique em **"Enable"**

3. **Acessar o SQL Editor**:
   - URL: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new
   - Ou: Dashboard → SQL Editor → New Query

4. **Configurar o cron job**:

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
```

5. **Verificar se o job foi criado**:

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

---

## 🧪 PASSO 3: Testar a Configuração

### 3.1. Verificar se há notificações pendentes:

```sql
SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 10;
```

### 3.2. Testar a Edge Function manualmente:

No Supabase Dashboard, vá em:
- **Edge Functions** → `process-time-clock-notifications` → **"Invoke"**
- Ou use curl:

```bash
curl -X POST 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdHNibnJubG56eW9mdXBlZ2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc5NTAyNiwiZXhwIjoyMDc2MzcxMDI2fQ.C4bs65teQiC4cQNgRfFjDmmT27dCkEoS_H3eQFmdl3s' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### 3.3. Verificar se as notificações foram processadas:

```sql
SELECT 
    id,
    status,
    attempts,
    error_message,
    sent_at,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## 🔄 PASSO 4: Reativar Notificações Falhadas

Se houver notificações com status `FAILED` do erro antigo ("column content does not exist"), reative-as:

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
SELECT COUNT(*) as reativadas
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
AND error_message IS NULL;
```

---

## ✅ PASSO 5: Verificar Configuração de Notificações

Certifique-se de que as configurações de notificação de ponto estão ativas:

```sql
SELECT 
    wnc.id,
    wnc.admin_id,
    wnc.store_id,
    wnc.phone,
    wnc.active,
    wnc.notification_type,
    s.name as store_name,
    p.email as admin_email
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
LEFT JOIN sistemaretiradas.profiles p ON p.id = wnc.admin_id
WHERE wnc.notification_type = 'CONTROLE_PONTO'
AND wnc.active = true
ORDER BY wnc.created_at DESC;
```

---

## 🐛 TROUBLESHOOTING

### Problema: Edge Function não está sendo chamada

**Solução 1: Verificar logs da Edge Function**
- Dashboard → Edge Functions → `process-time-clock-notifications` → Logs

**Solução 2: Verificar se pg_net está habilitado**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```
Se não estiver, habilite em: Dashboard → Database → Extensions

**Solução 3: Verificar se o cron job está ativo**
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'process-time-clock-notifications';
```

### Problema: Notificações ainda estão falhando

**Verificar logs da Edge Function** para ver o erro específico:
- Dashboard → Edge Functions → `process-time-clock-notifications` → Logs

**Verificar se a Netlify Function está acessível**:
```bash
curl -X POST 'https://eleveaone.com.br/.netlify/functions/send-whatsapp-message' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "96981032928",
    "message": "Teste",
    "store_id": "c6ecd68d-1d73-4c66-9ec5-f0a150e70bb3"
  }'
```

### Problema: Erro de CORS no frontend

Se ainda estiver vendo erros de CORS no console do navegador, verifique:
1. As políticas RLS foram aplicadas? (migrações `20251210000045_fix_time_clock_records_rls_for_loja.sql` e `20251210000042_fix_time_clock_hours_balance_rls.sql`)
2. O usuário tem permissão? Execute:

```sql
-- Verificar permissões do usuário atual
SELECT 
    id,
    email,
    role,
    store_id,
    is_active
FROM sistemaretiradas.profiles
WHERE id = auth.uid();
```

---

## 📊 MONITORAMENTO

### Ver estatísticas das notificações:

```sql
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

### Ver últimas execuções do cron job:

```sql
SELECT 
    runid,
    jobid,
    job_pid,
    database,
    username,
    command,
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

## 🎉 CONCLUSÃO

Após seguir todos os passos:

1. ✅ Edge Function deployada
2. ✅ Cron job configurado e ativo
3. ✅ Notificações sendo processadas automaticamente a cada minuto
4. ✅ Logs disponíveis para monitoramento

**Teste final**: Faça um registro de ponto e verifique se a notificação é enviada dentro de 1-2 minutos!

---

## 📞 SUPORTE

Se algo não funcionar:
1. Verifique os logs da Edge Function no Supabase Dashboard
2. Verifique os logs do cron job (última query SQL acima)
3. Verifique se há itens `PENDING` na fila (query do Passo 3.1)

---

**Última atualização**: 11/12/2025

