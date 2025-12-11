# 🔧 Solução: Erro 401 na Edge Function

## Problema Identificado

A Edge Function `process-time-clock-notifications` está retornando **401 Unauthorized** quando chamada pelo cron job.

**Causa**: O cron job está chamando a Edge Function via `pg_net.http_post` **sem header de autenticação**. Mesmo com `verify_jwt = false` no `config.toml`, o Supabase ainda exige o header `apikey` para Edge Functions.

## Solução

Adicionar o header `apikey` com a chave anônima do Supabase na chamada do cron job.

### Passo 1: Obter a Chave Anônima

1. Acesse: **Supabase Dashboard > Settings > API**
2. Em **Project API keys**, copie a chave **"anon public"**
3. A chave geralmente começa com `eyJ` e tem ~150-200 caracteres

### Passo 2: Configurar no Banco

Execute o script `CONFIGURAR_CHAVE_ANONIMA.sql`, substituindo `SUA_ANON_KEY_AQUI` pela chave real:

```sql
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;
```

### Passo 3: Atualizar Cron Job

Execute a migration `20251210000049_fix_cron_job_auth_header.sql` que atualiza o cron job para incluir o header `apikey`.

Ou execute manualmente:

```sql
DO $$
BEGIN
    -- Remover cron job antigo
    IF EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'process-time-clock-notifications'
    ) THEN
        PERFORM cron.unschedule('process-time-clock-notifications');
    END IF;

    -- Criar novo com header de autenticação
    PERFORM cron.schedule(
        'process-time-clock-notifications',
        '* * * * *',
        $$
        SELECT
            net.http_post(
                url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'apikey', (SELECT value FROM sistemaretiradas.app_config WHERE key = 'supabase_anon_key' LIMIT 1)
                ),
                body := '{}'::jsonb
            ) AS request_id;
        $$
    );
END $$;
```

### Passo 4: Verificar

Após alguns minutos, verifique:

1. **Logs da Edge Function** (Supabase Dashboard > Edge Functions > Logs)
   - Deve mostrar status 200 ao invés de 401

2. **Status dos itens na fila**:
```sql
SELECT COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
       COUNT(*) FILTER (WHERE status = 'SENT') as sent
FROM sistemaretiradas.time_clock_notification_queue;
```

3. **Invocations da Edge Function** (Dashboard > Invocations)
   - Deve mostrar status 200 ao invés de 401

## Alternativa: Usar Service Role Key

Se preferir usar a service role key (mais permissiva), você pode armazená-la também:

```sql
INSERT INTO sistemaretiradas.app_config (key, value)
VALUES ('supabase_service_role_key', 'SUA_SERVICE_ROLE_KEY')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;
```

E atualizar o cron job para usar `Authorization: Bearer` ao invés de `apikey`.

## Nota sobre Quota

Você também viu o banner "Organization plan has exceeded its quota". Isso pode estar causando limitações, mas não deveria causar 401. O 401 é especificamente um problema de autenticação.

