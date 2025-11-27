# 📅 CALENDÁRIO DE SINCRONIZAÇÃO INTELIGENTE

## 🎯 OBJETIVO

Implementar um sistema de sincronização com **múltiplas frequências** otimizadas:

1. **1 vez por semana**: Verificação completa desde o começo (hard sync absoluto)
2. **1 vez por dia**: Verificação dos últimos 7 dias
3. **2 vezes por dia**: Verificação das últimas 24h
4. **A cada 30 segundos**: Verificação "push" de novas vendas (apenas última venda)
5. **A cada 30 minutos**: Atualização de novas vendas (últimas 2 horas)

---

## 📊 CALENDÁRIO PROPOSTO

| Frequência | Tipo de Sync | Período | Horário | Descrição |
|------------|--------------|---------|---------|-----------|
| **1x por semana** | Hard Sync Absoluto | Desde 2010-01-01 | Domingo 02:00 | Verificação completa de tudo |
| **1x por dia** | Sync 7 dias | Últimos 7 dias | 03:00 | Verificação semanal |
| **2x por dia** | Sync 24h | Últimas 24 horas | 06:00 e 18:00 | Verificação diária |
| **30 em 30 segundos** | Push Sync | Última venda | Contínuo | Verificação quase em tempo real |
| **30 em 30 minutos** | Incremental | Últimas 2 horas | Contínuo | Verificação incremental |

---

## 🔧 IMPLEMENTAÇÃO

### **Opção 1: Múltiplos Jobs no pg_cron**

Criar 4 jobs diferentes no pg_cron:
1. `sync-weekly-full` - Domingo 02:00
2. `sync-daily-7days` - Diariamente 03:00
3. `sync-twice-daily-24h` - 06:00 e 18:00
4. `sync-30min-incremental` - A cada 30 minutos
5. `sync-30sec-push` - A cada 30 segundos (⚠️ muito frequente!)

### **Opção 2: Job Único com Parâmetros**

Criar 1 job que roda a cada 30 segundos e decide internamente qual sync fazer baseado na hora/data.

**Recomendação:** **Opção 1** (múltiplos jobs) é mais clara e fácil de gerenciar.

---

## ⚠️ CONSIDERAÇÕES TÉCNICAS

### **30 segundos é MUITO frequente!**

- ⚠️ **Limite do pg_cron**: pg_cron pode ter limitações de frequência mínima
- ⚠️ **Custo**: Muitas requisições podem aumentar custos
- ⚠️ **Risco**: Pode sobrecarregar a API do Tiny ERP

**Alternativa:**
- Usar **1-2 minutos** em vez de 30 segundos (ainda é muito rápido!)
- Ou fazer **polling inteligente** que detecta quando há nova venda

### **Otimização:**
- Sync de 30 segundos pode ser apenas "última venda" (limit=1, max_pages=1)
- Sync de 30 minutos pode ser "últimas 2 horas" (limit=100, max_pages=1)

---

## 📋 SQL PARA CRIAR OS JOBS

### **Job 1: Hard Sync Semanal (Domingo 02:00)**
```sql
SELECT cron.schedule(
    'sync-weekly-full',
    '0 2 * * 0', -- Todo domingo às 02:00
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', true,
            'data_inicio', '2010-01-01',
            'max_pages', 99999
        )
    ) AS request_id;
    $$
);
```

### **Job 2: Sync Diário 7 dias (Diariamente 03:00)**
```sql
SELECT cron.schedule(
    'sync-daily-7days',
    '0 3 * * *', -- Todo dia às 03:00
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', false,
            'data_inicio', (CURRENT_DATE - INTERVAL '7 days')::text,
            'max_pages', 50
        )
    ) AS request_id;
    $$
);
```

### **Job 3: Sync 2x por dia 24h (06:00 e 18:00)**
```sql
SELECT cron.schedule(
    'sync-twice-daily-24h-1',
    '0 6 * * *', -- Todo dia às 06:00
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', false,
            'data_inicio', (CURRENT_DATE - INTERVAL '1 day')::text,
            'max_pages', 20
        )
    ) AS request_id;
    $$
);

SELECT cron.schedule(
    'sync-twice-daily-24h-2',
    '0 18 * * *', -- Todo dia às 18:00
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', false,
            'data_inicio', (CURRENT_DATE - INTERVAL '1 day')::text,
            'max_pages', 20
        )
    ) AS request_id;
    $$
);
```

### **Job 4: Sync Incremental 30 minutos (A cada 30 minutos)**
```sql
SELECT cron.schedule(
    'sync-30min-incremental',
    '*/30 * * * *', -- A cada 30 minutos
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', false,
            'data_inicio', (CURRENT_TIMESTAMP - INTERVAL '2 hours')::date::text,
            'max_pages', 5,
            'limit', 50
        )
    ) AS request_id;
    $$
);
```

### **Job 5: Sync Push 30 segundos (A cada 30 segundos) - ⚠️ ATENÇÃO!**
```sql
-- ⚠️ AVISO: 30 segundos é muito frequente!
-- Recomendado: usar 1-2 minutos em vez disso
SELECT cron.schedule(
    'sync-30sec-push',
    '*/30 * * * * *', -- A cada 30 segundos (formato: segundo minuto hora dia mês dia-semana)
    $$
    SELECT net.http_post(
        url := 'https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
            'sync_type', 'ORDERS',
            'hard_sync', false,
            'data_inicio', (CURRENT_TIMESTAMP - INTERVAL '5 minutes')::date::text,
            'max_pages', 1,
            'limit', 1 -- Apenas última venda!
        )
    ) AS request_id;
    $$
);
```

---

## ⚠️ PROBLEMA: pg_cron não suporta segundos!

**pg_cron** só suporta formato padrão de cron (minuto hora dia mês dia-semana).

**Formato mínimo:** `*/1 * * * *` = a cada 1 minuto (mínimo)

**Solução para 30 segundos:**
1. Usar **1 minuto** como mínimo (mais prático)
2. Ou criar um **loop interno** na Edge Function que roda a cada 30 segundos
3. Ou usar **webhook** do Tiny ERP (se disponível)

---

## ✅ RECOMENDAÇÃO FINAL

### **Calendário Otimizado:**

| Frequência | Tipo | Período | Horário Cron | Limite |
|------------|------|---------|--------------|--------|
| **1x por semana** | Hard Sync | Desde 2010 | `0 2 * * 0` | max_pages: 99999 |
| **1x por dia** | Sync 7 dias | Últimos 7 dias | `0 3 * * *` | max_pages: 50 |
| **2x por dia** | Sync 24h | Últimas 24h | `0 6,18 * * *` | max_pages: 20 |
| **A cada 5 minutos** | Push Sync | Últimos 5 min | `*/5 * * * *` | limit: 1, max_pages: 1 |
| **A cada 30 minutos** | Incremental | Últimas 2h | `*/30 * * * *` | max_pages: 5 |

**Nota:** 30 segundos → ajustado para **5 minutos** (mais prático e eficiente)

---

## 📝 IMPLEMENTAÇÃO

1. ✅ Criar migration SQL com todos os jobs
2. ✅ Ajustar Edge Function para detectar tipo de sync
3. ✅ Ajustar Netlify Function para aceitar parâmetros diferentes
4. ✅ Testar cada frequência separadamente
5. ✅ Monitorar performance e custos

