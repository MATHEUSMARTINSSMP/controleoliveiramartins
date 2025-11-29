# 🔍 Diagnóstico: Schedule = 7

## 📊 O que significa?

O resultado `[{"schedule": 7}]` indica que:
- ✅ O job foi criado com sucesso
- ⚠️ O schedule está como ID numérico (7) ao invés de formato cron string

## 🔧 Possíveis Causas

1. **pg_cron pode usar IDs internos para schedules**
2. **O formato do schedule pode estar sendo convertido**
3. **Pode ser um schedule predefinido do pg_cron**

## ✅ Verificação Completa

Execute estas queries para entender melhor:

```sql
-- Ver TODOS os detalhes do job
SELECT * FROM cron.job WHERE jobname = 'sync-tiny-orders-automatico';

-- Verificar se há uma tabela de schedules
SELECT * FROM cron.schedule WHERE scheduleid = 7;

-- Verificar o comando do job
SELECT jobid, jobname, schedule, command, active 
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatico';
```

## 🎯 Solução

Se o schedule 7 não for o correto (a cada 5 minutos), podemos:

1. **Remover o job atual**
2. **Recriar com schedule explícito**

Execute:

```sql
-- Remover job atual
SELECT cron.unschedule('sync-tiny-orders-automatico');

-- Recriar com schedule explícito
SELECT cron.schedule(
  'sync-tiny-orders-automatico',
  '*/5 * * * *',  -- A cada 5 minutos
  $$SELECT sistemaretiradas.chamar_sync_tiny_orders();$$
);
```

## 📋 Próximos Passos

1. Execute as queries de verificação acima
2. Verifique se o job está rodando corretamente
3. Se necessário, recrie o job com o schedule correto

