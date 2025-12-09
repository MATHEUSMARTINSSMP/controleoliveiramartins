# Correção do Sistema de Alertas

## Problemas Identificados e Corrigidos

### 1. ❌ Lógica de Comparação de Horários (CRÍTICO)

**Problema:**
A função SQL estava comparando horários usando um intervalo de tempo:
```sql
WHERE h::TIME <= v_current_time
AND h::TIME >= v_current_time - INTERVAL '1 minute'
```

Isso só funcionava se o cron job rodasse exatamente no segundo 00 do minuto. Se rodasse em qualquer outro segundo (ex: 20:09:30), o alerta para 20:09 não era detectado.

**Correção:**
Agora compara apenas horas e minutos, ignorando segundos:
```sql
WHERE TO_CHAR(h::TIME, 'HH24:MI') = TO_CHAR(CURRENT_TIME, 'HH24:MI')
```

Isso garante que alertas sejam detectados independentemente do segundo em que o cron roda.

### 2. ❌ Verificação de Duplicatas Incompleta

**Problema:**
A verificação de duplicatas só checava mensagens com status `PENDING`, mas não verificava se já havia sido enviada (`SENT`). Isso poderia causar duplicatas se a função rodasse múltiplas vezes.

**Correção:**
Agora verifica tanto `PENDING` quanto `SENT`:
```sql
WHERE status IN ('PENDING', 'SENT')
```

### 3. ✅ Função de Diagnóstico Adicionada

Criada função `diagnosticar_sistema_alertas()` que permite verificar:
- Status atual do sistema
- Quantidade de alertas ativos
- Mensagens pendentes na fila
- Mensagens enviadas/falhadas hoje
- Alertas que deveriam ser disparados no momento atual

## Como Verificar se Está Funcionando

### 1. Executar a Migration no Supabase

As migrations já foram criadas e commitadas. Execute-as no Supabase:

```sql
-- Migration 1: Correção da lógica
-- Arquivo: supabase/migrations/20251210000012_fix_alert_system_logic.sql

-- Migration 2: Função de diagnóstico
-- Arquivo: supabase/migrations/20251210000013_add_alert_diagnostic_function.sql
```

### 2. Verificar se o Cron Job Está Configurado

Execute no Supabase SQL Editor:

```sql
-- Verificar se o cron job existe
SELECT * FROM cron.job WHERE jobname = 'process-store-task-alerts';

-- Verificar execuções recentes
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-store-task-alerts')
ORDER BY start_time DESC
LIMIT 10;
```

Se o cron job não existir, execute a migration:
```sql
-- Arquivo: supabase/migrations/20251210000003_create_cron_job_process_alerts.sql
```

### 3. Usar a Função de Diagnóstico

Execute no Supabase SQL Editor:

```sql
SELECT sistemaretiradas.diagnosticar_sistema_alertas();
```

Isso retornará um JSON com:
- Status atual do sistema
- Alertas que deveriam ser disparados agora
- Contadores de mensagens

### 4. Verificar a Fila de Mensagens

```sql
-- Ver mensagens pendentes
SELECT * FROM sistemaretiradas.store_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC;

-- Ver mensagens enviadas hoje
SELECT * FROM sistemaretiradas.store_notification_queue
WHERE status = 'SENT'
AND sent_at::DATE = CURRENT_DATE
ORDER BY sent_at DESC;

-- Ver mensagens falhadas hoje
SELECT * FROM sistemaretiradas.store_notification_queue
WHERE status = 'FAILED'
AND created_at::DATE = CURRENT_DATE
ORDER BY created_at DESC;
```

### 5. Testar Manualmente

Para testar se a função está funcionando, execute:

```sql
-- Executar a função manualmente
SELECT sistemaretiradas.process_store_task_alerts();
```

Isso deve:
1. Identificar alertas que devem ser enviados agora
2. Inserir mensagens na fila
3. Retornar contagem de mensagens inseridas

### 6. Verificar se a Netlify Function Está Funcionando

A função `process-store-task-alerts.js` processa a fila. Você pode testá-la manualmente chamando:

```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-store-task-alerts
```

Ou através do Supabase, o cron job chama automaticamente.

## Checklist de Verificação

- [ ] Migrations executadas no Supabase
- [ ] Cron job configurado e rodando
- [ ] Função de diagnóstico retorna informações corretas
- [ ] Alertas ativos configurados com horários e dias corretos
- [ ] Loja tem WhatsApp ativo (`whatsapp_ativo = true`)
- [ ] Destinatários configurados e ativos
- [ ] Função `send-whatsapp-message` existe e está funcionando
- [ ] Mensagens aparecem na fila quando deveriam
- [ ] Mensagens são processadas e enviadas

## Próximos Passos

1. **Executar as migrations** no Supabase Dashboard
2. **Verificar o cron job** está configurado
3. **Usar a função de diagnóstico** para verificar o status
4. **Aguardar o próximo horário** de um alerta configurado
5. **Verificar se a mensagem** foi inserida na fila
6. **Verificar se a mensagem** foi enviada

## Problemas Comuns

### Cron Job Não Está Rodando

Se o cron job não existir, verifique:
1. Se `pg_cron` está habilitado no Supabase (Dashboard > Database > Extensions)
2. Se a migration do cron job foi executada
3. Se há erros nos logs do cron job

### Mensagens Não Aparecem na Fila

Verifique:
1. Se o alerta está ativo (`ativo = true`)
2. Se a loja tem WhatsApp ativo (`whatsapp_ativo = true`)
3. Se o horário atual corresponde ao horário configurado
4. Se o dia da semana atual está nos dias configurados
5. Se o limite diário não foi atingido (`envios_hoje < 10`)

### Mensagens na Fila Mas Não Enviadas

Verifique:
1. Se a função `send-whatsapp-message` está funcionando
2. Se há erros na função `process-store-task-alerts`
3. Se as credenciais WhatsApp estão configuradas corretamente
4. Se há logs de erro no Netlify Functions

## Suporte

Se ainda houver problemas após seguir este guia, use a função de diagnóstico para coletar informações e verificar os logs do Supabase e Netlify.

