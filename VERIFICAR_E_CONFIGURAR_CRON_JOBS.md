# Verificação e Configuração de Cron Jobs para Sistema de Alertas

## 📋 Visão Geral

O sistema de alertas precisa de um mecanismo para processar mensagens periodicamente. Existem duas opções principais:

1. **pg_cron** (Recomendado) - Executa jobs diretamente no banco de dados
2. **Netlify Scheduled Functions** (Alternativa) - Executa via Netlify

## ✅ Opção 1: Usar pg_cron (Recomendado)

### Verificar se pg_cron está habilitado

Execute no Supabase SQL Editor:

```sql
SELECT sistemaretiradas.verificar_status_cron();
```

Ou verifique diretamente:

```sql
SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
) AS pg_cron_enabled;
```

### Habilitar pg_cron

1. Acesse o **Supabase Dashboard**
2. Vá em **Database** > **Extensions**
3. Procure por **pg_cron**
4. Clique em **Enable**

### Verificar Jobs Configurados

```sql
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job
WHERE jobname IN ('process-store-task-alerts', 'reset-daily-sends');
```

### Executar Migration

A migration `20251210000003_create_cron_job_process_alerts.sql` já cria os jobs automaticamente se pg_cron estiver habilitado.

## 🔄 Opção 2: Netlify Scheduled Functions (Alternativa)

Se pg_cron não estiver disponível, use Netlify Scheduled Functions.

### Configurar Netlify Scheduled Function

1. Crie o arquivo `netlify/functions/process-store-task-alerts-scheduled.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { db: { schema: 'sistemaretiradas' } }
  );

  // Chamar função RPC para identificar alertas e inserir na fila
  await supabaseAdmin.rpc('process_store_task_alerts');

  // Chamar função Netlify para processar a fila
  const netlifyUrl = process.env.NETLIFY_FUNCTIONS_URL 
    ? `${process.env.NETLIFY_FUNCTIONS_URL}/.netlify/functions/process-store-task-alerts`
    : 'https://eleveaone.com.br/.netlify/functions/process-store-task-alerts';

  const response = await fetch(netlifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
```

2. Configure o schedule no `netlify.toml`:

```toml
[[functions]]
  name = "process-store-task-alerts-scheduled"
  schedule = "* * * * *"  # A cada minuto
```

Ou use a interface do Netlify Dashboard:
- Vá em **Functions** > **Scheduled Functions**
- Configure para executar a cada 1 minuto

## 🧪 Testar o Sistema

### Teste Manual

1. **Criar um alerta de teste:**
   - Acesse Admin Dashboard > Avisos
   - Crie um novo alerta com horário atual
   - Adicione um destinatário

2. **Verificar fila:**
```sql
SELECT 
    id,
    notification_id,
    phone,
    message,
    status,
    created_at
FROM sistemaretiradas.store_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;
```

3. **Processar manualmente:**
   - Chame a função Netlify diretamente:
   ```bash
   curl -X POST https://eleveaone.com.br/.netlify/functions/process-store-task-alerts
   ```

4. **Verificar resultado:**
```sql
SELECT 
    id,
    status,
    sent_at,
    error_message,
    retry_count
FROM sistemaretiradas.store_notification_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

## 🔍 Troubleshooting

### Problema: Jobs não estão executando

**Solução 1:** Verificar se pg_cron está habilitado
```sql
SELECT sistemaretiradas.verificar_status_cron();
```

**Solução 2:** Verificar logs do Supabase
- Dashboard > Logs > Postgres Logs
- Procure por mensagens de erro do pg_cron

**Solução 3:** Usar Netlify Scheduled Functions como alternativa

### Problema: Mensagens não estão sendo enviadas

1. Verificar se há mensagens na fila:
```sql
SELECT COUNT(*) FROM sistemaretiradas.store_notification_queue WHERE status = 'PENDING';
```

2. Verificar se a função Netlify está funcionando:
```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-store-task-alerts
```

3. Verificar logs da função Netlify:
- Dashboard > Functions > process-store-task-alerts > Logs

### Problema: Erro "pg_cron não está habilitado"

**Solução:** Habilite pg_cron no Supabase Dashboard ou configure Netlify Scheduled Functions.

## 📊 Monitoramento

### Verificar Estatísticas de Envio

```sql
SELECT 
    DATE(created_at) as data,
    status,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'SENT') as enviadas,
    COUNT(*) FILTER (WHERE status = 'FAILED') as falhas
FROM sistemaretiradas.store_notification_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), status
ORDER BY data DESC, status;
```

### Verificar Alertas Ativos

```sql
SELECT 
    sn.id,
    sn.nome,
    sn.store_id,
    s.name as store_name,
    sn.ativo,
    sn.envios_hoje,
    COUNT(snr.id) as destinatarios
FROM sistemaretiradas.store_notifications sn
JOIN sistemaretiradas.stores s ON s.id = sn.store_id
LEFT JOIN sistemaretiradas.store_notification_recipients snr ON snr.notification_id = sn.id AND snr.ativo = true
WHERE sn.ativo = true
GROUP BY sn.id, sn.nome, sn.store_id, s.name, sn.ativo, sn.envios_hoje;
```

## ✅ Checklist de Configuração

- [ ] Verificar se pg_cron está habilitado
- [ ] Executar migration `20251210000003_create_cron_job_process_alerts.sql`
- [ ] Verificar se jobs foram criados
- [ ] Testar criação de alerta
- [ ] Verificar se mensagens aparecem na fila
- [ ] Verificar se mensagens são processadas
- [ ] Verificar se mensagens são enviadas via WhatsApp
- [ ] Configurar alternativa (Netlify Scheduled Functions) se necessário

## 📝 Notas Importantes

1. **pg_cron** é a solução preferida pois executa diretamente no banco
2. **Netlify Scheduled Functions** é uma alternativa confiável se pg_cron não estiver disponível
3. O sistema funciona mesmo sem cron jobs - basta chamar a função manualmente
4. A função `process_store_task_alerts()` identifica alertas e insere na fila
5. A função Netlify `process-store-task-alerts` processa a fila e envia mensagens

