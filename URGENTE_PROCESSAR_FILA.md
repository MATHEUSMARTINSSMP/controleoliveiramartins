# ⚠️ URGENTE: Processar Fila de WhatsApp Agora

## 🔴 PROBLEMA

Há mensagens **PENDING** na fila há mais de 2 minutos que não foram processadas!

**Exemplo:**
- Mensagem criada às **19:20:17** - Ainda PENDING (0 tentativas)
- Mensagem criada às **19:18:05** - Ainda PENDING (0 tentativas)

## ✅ SOLUÇÃO IMEDIATA

### Opção 1: Processar Manualmente Agora (Mais Rápido)

#### Via Script Node.js:

```bash
# No terminal, execute:
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"
node PROCESSAR_FILA_AGORA.js
```

#### Via cURL (Direto):

```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue
```

### Opção 2: Processar via Supabase SQL

Execute no Supabase SQL Editor:

```sql
-- Usar pg_net para chamar a Netlify Function
SELECT 
    net.http_post(
        url := 'https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
    ) as request_id;
```

**⚠️ Nota:** Requer que a extensão `pg_net` esteja habilitada no Supabase.

---

## 🔧 SOLUÇÃO PERMANENTE: Cron Job

Para evitar que isso aconteça novamente, crie um **cron job** para processar a fila automaticamente:

### Passo 1: Habilitar pg_cron no Supabase

1. Acesse Supabase Dashboard
2. Vá em **Database > Extensions**
3. Procure por `pg_cron` e clique em **Enable**

### Passo 2: Executar Migration

Execute a migration: `supabase/migrations/20250131000009_add_cron_processar_fila_whatsapp.sql`

Isso criará:
- ✅ Função para chamar Netlify Function
- ✅ Cron job que executa **a cada 1 minuto**

### Passo 3: Verificar

Depois de alguns minutos, verifique se está funcionando:

```sql
-- Ver logs do cron job
SELECT * FROM cron.job_run_details 
WHERE jobid = (
    SELECT jobid FROM cron.job 
    WHERE jobname = 'processar-fila-whatsapp-cashback'
)
ORDER BY start_time DESC
LIMIT 10;
```

---

## 📋 PROCESSO COMPLETO

### Agora (Urgente):

1. ✅ Execute `PROCESSAR_FILA_AGORA.js` ou cURL para processar mensagens pendentes
2. ✅ Verifique a fila novamente: `VERIFICAR_FILA_WHATSAPP_CASHBACK.sql` (Query 2)

### Depois (Permanente):

1. ✅ Habilitar `pg_cron` no Supabase
2. ✅ Executar migration `20250131000009_add_cron_processar_fila_whatsapp.sql`
3. ✅ Verificar que o cron job está funcionando

---

## 🔍 VERIFICAR SE ESTÁ FUNCIONANDO

```sql
-- Ver mensagens pendentes
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga,
    NOW() - MIN(created_at) as tempo_mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

Se houver muitas pendentes há muito tempo, o cron job não está funcionando!

---

**Status:** 🔴 **AÇÃO URGENTE NECESSÁRIA**

