# Implementação: Sincronização Automática em Background

## 📋 Lista de TODO - 3 Etapas

### ✅ ETAPA 1: Configuração no Supabase (Você faz)

#### 1.1. Habilitar Extensão pg_cron
1. Acesse: **Supabase Dashboard** → Seu Projeto
2. Vá em: **Database** → **Extensions**
3. Procure por: **pg_cron**
4. Clique em: **Enable**

#### 1.2. Configurar Service Role Key como Secret
1. Acesse: **Supabase Dashboard** → Seu Projeto
2. Vá em: **Project Settings** → **API**
3. Copie a **Service Role Key** (⚠️ NÃO é a anon key!)
4. Vá em: **Project Settings** → **Edge Functions** → **Secrets**
5. Adicione novo secret:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Cole a Service Role Key copiada

#### 1.3. Executar Migration SQL
1. Acesse: **Supabase Dashboard** → Seu Projeto
2. Vá em: **SQL Editor**
3. Execute o arquivo: `supabase/migrations/20250129000000_enable_pg_cron_and_schedule_sync.sql`
4. ⚠️ **IMPORTANTE:** Antes de executar, edite a linha com a URL do seu projeto:
   ```sql
   -- Substituir 'SEU_PROJETO_SUPABASE' pela URL real
   url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
   ```

---

### ✅ ETAPA 2: Deploy da Edge Function (Sistema faz)

#### 2.1. Verificar Arquivo da Edge Function
- ✅ Arquivo criado: `supabase/functions/sync-tiny-orders/index.ts`

#### 2.2. Configurar Variáveis de Ambiente
A Edge Function precisa das seguintes variáveis:
- `SUPABASE_URL` - Já configurado automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Configurado como secret na Etapa 1.2
- `NETLIFY_FUNCTION_URL` - URL do seu site Netlify (opcional, se usar Netlify Function)

#### 2.3. Deploy via Supabase CLI
```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Link do projeto
supabase link --project-ref seu-project-ref

# Deploy da Edge Function
supabase functions deploy sync-tiny-orders
```

**OU** via Supabase Dashboard:
1. Acesse: **Edge Functions**
2. Clique em: **Create a new function**
3. Nome: `sync-tiny-orders`
4. Cole o código de `supabase/functions/sync-tiny-orders/index.ts`
5. Clique em: **Deploy**

---

### ✅ ETAPA 3: Agendar Execução (Você faz no Supabase)

#### 3.1. Verificar se pg_cron está Habilitado
Execute no SQL Editor:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```
Deve retornar 1 linha.

#### 3.2. Agendar Sincronização Manualmente
Execute no SQL Editor (substitua `SEU_PROJETO_SUPABASE` pela URL real):

```sql
-- Remover agendamento anterior (se existir)
SELECT cron.unschedule('sync-tiny-orders-automatic');

-- Agendar nova sincronização (a cada 30 minutos)
SELECT cron.schedule(
    'sync-tiny-orders-automatic',
    '*/30 * * * *', -- A cada 30 minutos (cron format)
    $$
    SELECT
        net.http_post(
            url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            )::jsonb,
            body := '{}'::jsonb
        ) AS request_id;
    $$
);
```

#### 3.3. Verificar Agendamento
Execute no SQL Editor:
```sql
SELECT * FROM cron.job WHERE jobname = 'sync-tiny-orders-automatic';
```

#### 3.4. Testar Execução Manual (Opcional)
Execute no SQL Editor para testar:
```sql
-- Executar imediatamente (teste)
SELECT cron.schedule(
    'sync-tiny-orders-test',
    'NOW()',
    $$
    SELECT
        net.http_post(
            url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            )::jsonb,
            body := '{}'::jsonb
        ) AS request_id;
    $$
);
```

---

## 🔧 Configuração Adicional

### Ajustar Intervalo de Sincronização

**A cada 15 minutos:**
```sql
'*/15 * * * *'
```

**A cada 1 hora:**
```sql
'0 * * * *'
```

**A cada 2 horas:**
```sql
'0 */2 * * *'
```

### Ver Logs de Execução

Execute no SQL Editor:
```sql
-- Ver últimas execuções
SELECT 
    jobid,
    jobname,
    schedule,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobid
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatic';

-- Ver histórico de execuções (se habilitado)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-tiny-orders-automatic')
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ Verificação Final

### Checklist de Verificação

- [ ] pg_cron habilitado no Supabase
- [ ] Service Role Key configurado como secret
- [ ] Edge Function `sync-tiny-orders` deployada
- [ ] Agendamento criado no pg_cron
- [ ] Primeira execução testada (verificar logs)

### Como Verificar se Está Funcionando

1. **Verificar Logs da Edge Function:**
   - Supabase Dashboard → Edge Functions → `sync-tiny-orders` → Logs

2. **Verificar Logs de Sincronização:**
   ```sql
   SELECT * FROM sistemaretiradas.erp_sync_logs 
   WHERE tipo_sync = 'PEDIDOS_AUTO'
   ORDER BY sync_at DESC
   LIMIT 10;
   ```

3. **Verificar Novos Pedidos:**
   - Acesse `/erp/dashboard`
   - Verifique se novos pedidos aparecem automaticamente

---

## 🐛 Troubleshooting

### Problema: pg_cron não está disponível
**Solução:** Habilite manualmente no Supabase Dashboard → Database → Extensions

### Problema: Edge Function retorna erro 401
**Solução:** Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurado como secret

### Problema: Agendamento não executa
**Solução:** 
1. Verifique se pg_cron está habilitado
2. Verifique a URL da Edge Function (deve ser a URL correta do seu projeto)
3. Execute manualmente para ver o erro

### Problema: Sincronização não funciona
**Solução:**
1. Verifique logs da Edge Function
2. Verifique se as integrações estão com `sync_status = 'CONNECTED'`
3. Verifique se `access_token` não está expirado

---

## 📝 Notas Importantes

1. **Service Role Key:** ⚠️ MUITO SENSÍVEL - nunca exponha no frontend
2. **Intervalo:** 30 minutos é um bom equilíbrio entre atualização e carga no servidor
3. **Custo:** Edge Functions têm limite gratuito, depois há cobrança por execução
4. **Monitoramento:** Acompanhe os logs regularmente para garantir que está funcionando

---

## 🚀 Próximos Passos Após Implementação

1. Monitorar logs por 24 horas
2. Ajustar intervalo se necessário
3. Configurar alertas (opcional)
4. Documentar para a equipe

