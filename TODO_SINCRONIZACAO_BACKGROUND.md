# ✅ TODO: Sincronização Automática em Background

## 📋 Lista de Tarefas - 3 Etapas

---

## 🟡 ETAPA 1: Configuração no Supabase (VOCÊ FAZ)

### ✅ 1.1. Habilitar Extensão pg_cron
**Onde:** Supabase Dashboard → Database → Extensions

**Passos:**
1. Acesse o Supabase Dashboard do seu projeto
2. No menu lateral, clique em **Database**
3. Clique na aba **Extensions**
4. Procure por **pg_cron** na lista
5. Clique no botão **Enable** ao lado de pg_cron
6. Aguarde a confirmação (pode levar alguns segundos)

**Verificação:**
```sql
-- Execute no SQL Editor para verificar
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- Deve retornar 1 linha
```

---

### ✅ 1.2. Configurar Service Role Key como Secret
**Onde:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Passos:**
1. Acesse o Supabase Dashboard do seu projeto
2. No menu lateral, clique em **Project Settings**
3. Clique em **API** (no menu lateral de Settings)
4. Na seção **Project API keys**, encontre **service_role** (⚠️ NÃO é a anon key!)
5. Clique no ícone de **olho** para revelar a chave
6. **Copie** a Service Role Key (ela começa com `eyJ...`)
7. Volte para **Project Settings**
8. Clique em **Edge Functions** (no menu lateral)
9. Clique na aba **Secrets**
10. Clique em **Add new secret**
11. Preencha:
    - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
    - **Value:** Cole a Service Role Key copiada
12. Clique em **Save**

**⚠️ IMPORTANTE:** Esta chave é MUITO SENSÍVEL. Nunca exponha no frontend!

---

### ✅ 1.3. Executar Migration SQL
**Onde:** Supabase Dashboard → SQL Editor

**Passos:**
1. Acesse o Supabase Dashboard do seu projeto
2. No menu lateral, clique em **SQL Editor**
3. Clique em **New query**
4. Abra o arquivo: `supabase/migrations/20250129000000_enable_pg_cron_and_schedule_sync.sql`
5. **⚠️ ANTES DE EXECUTAR:** Edite a linha que contém a URL:
   ```sql
   -- ANTES:
   url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
   
   -- DEPOIS (substitua SEU_PROJETO_SUPABASE pela URL real):
   url := 'https://kktsbnrnlnzyofupeqjc.supabase.co/functions/v1/sync-tiny-orders',
   ```
   (A URL do seu projeto está em: Project Settings → API → Project URL)
6. Cole o SQL editado no editor
7. Clique em **Run** (ou pressione Ctrl+Enter)
8. Verifique se não há erros

**Verificação:**
```sql
-- Verificar se a tabela foi criada
SELECT * FROM sistemaretiradas.erp_sync_schedule;
```

---

## 🟡 ETAPA 2: Deploy da Edge Function (VOCÊ FAZ)

### ✅ 2.1. Instalar Supabase CLI (se não tiver)
**No terminal:**
```bash
npm install -g supabase
```

### ✅ 2.2. Login no Supabase
**No terminal:**
```bash
supabase login
```
- Isso abrirá o navegador para autenticação
- Após login, volte ao terminal

### ✅ 2.3. Link do Projeto
**No terminal:**
```bash
# Navegue até a pasta do projeto
cd /home/matheusmartins/controleoliveiramartins-1

# Link do projeto (substitua pelo seu project-ref)
supabase link --project-ref kktsbnrnlnzyofupeqjc
```
(O project-ref está em: Supabase Dashboard → Project Settings → General → Reference ID)

### ✅ 2.4. Deploy da Edge Function
**No terminal:**
```bash
supabase functions deploy sync-tiny-orders
```

**Verificação:**
- Acesse: Supabase Dashboard → Edge Functions
- Deve aparecer `sync-tiny-orders` na lista
- Status deve ser **Active**

---

## 🟡 ETAPA 3: Agendar Execução (VOCÊ FAZ NO SUPABASE)

### ✅ 3.1. Verificar se pg_cron está Habilitado
**No SQL Editor do Supabase:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```
**Resultado esperado:** 1 linha retornada

---

### ✅ 3.2. Agendar Sincronização
**No SQL Editor do Supabase:**

**⚠️ IMPORTANTE:** Substitua `SEU_PROJETO_SUPABASE` pela URL real do seu projeto!

```sql
-- Remover agendamento anterior (se existir)
SELECT cron.unschedule('sync-tiny-orders-automatic');

-- Agendar nova sincronização (a cada 30 minutos)
SELECT cron.schedule(
    'sync-tiny-orders-automatic',
    '*/30 * * * *', -- A cada 30 minutos (formato cron)
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

**Onde encontrar a URL:**
- Supabase Dashboard → Project Settings → API → Project URL
- Exemplo: `https://kktsbnrnlnzyofupeqjc.supabase.co`

---

### ✅ 3.3. Verificar Agendamento
**No SQL Editor do Supabase:**
```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    database,
    username
FROM cron.job 
WHERE jobname = 'sync-tiny-orders-automatic';
```

**Resultado esperado:** 1 linha com `active = true`

---

### ✅ 3.4. Testar Execução Manual (Opcional)
**No SQL Editor do Supabase:**
```sql
-- Executar imediatamente para testar
SELECT
    net.http_post(
        url := 'https://SEU_PROJETO_SUPABASE.supabase.co/functions/v1/sync-tiny-orders',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        )::jsonb,
        body := '{}'::jsonb
    ) AS request_id;
```

**Verificar resultado:**
1. Acesse: Supabase Dashboard → Edge Functions → `sync-tiny-orders` → Logs
2. Deve aparecer um log recente com status 200
3. Verifique a resposta para confirmar que sincronizou

---

## ✅ Verificação Final

### Checklist Completo

- [ ] **Etapa 1.1:** pg_cron habilitado ✅
- [ ] **Etapa 1.2:** Service Role Key configurado como secret ✅
- [ ] **Etapa 1.3:** Migration SQL executada ✅
- [ ] **Etapa 2.1:** Supabase CLI instalado ✅
- [ ] **Etapa 2.2:** Login no Supabase feito ✅
- [ ] **Etapa 2.3:** Projeto linkado ✅
- [ ] **Etapa 2.4:** Edge Function deployada ✅
- [ ] **Etapa 3.1:** pg_cron verificado ✅
- [ ] **Etapa 3.2:** Agendamento criado ✅
- [ ] **Etapa 3.3:** Agendamento verificado ✅
- [ ] **Etapa 3.4:** Teste manual executado (opcional) ✅

---

## 🔍 Como Verificar se Está Funcionando

### 1. Verificar Logs da Edge Function
- Acesse: **Supabase Dashboard** → **Edge Functions** → `sync-tiny-orders` → **Logs**
- Deve aparecer execuções a cada 30 minutos
- Status deve ser **200 OK**

### 2. Verificar Logs de Sincronização
**No SQL Editor:**
```sql
SELECT 
    store_id,
    tipo_sync,
    status,
    registros_sincronizados,
    registros_atualizados,
    sync_at
FROM sistemaretiradas.erp_sync_logs 
WHERE tipo_sync = 'PEDIDOS_AUTO'
ORDER BY sync_at DESC
LIMIT 10;
```

### 3. Verificar Novos Pedidos
- Acesse `/erp/dashboard`
- Aguarde 30 minutos
- Verifique se novos pedidos aparecem automaticamente (mesmo com página fechada)

---

## 🐛 Troubleshooting

### ❌ Problema: "pg_cron não está disponível"
**Solução:**
1. Verifique se está no plano correto do Supabase (pg_cron requer plano Pro ou superior)
2. Ou habilite manualmente: Database → Extensions → pg_cron → Enable

### ❌ Problema: "Edge Function retorna 401 Unauthorized"
**Solução:**
1. Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurado como secret
2. Verifique se o nome do secret está exatamente: `SUPABASE_SERVICE_ROLE_KEY`
3. Verifique se a chave está correta (deve ser a service_role, não anon)

### ❌ Problema: "Agendamento não executa"
**Solução:**
1. Verifique se pg_cron está habilitado: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
2. Verifique a URL da Edge Function (deve ser a URL correta do seu projeto)
3. Verifique se o agendamento existe: `SELECT * FROM cron.job WHERE jobname = 'sync-tiny-orders-automatic';`
4. Execute manualmente para ver o erro

### ❌ Problema: "Sincronização não funciona"
**Solução:**
1. Verifique logs da Edge Function
2. Verifique se as integrações estão com `sync_status = 'CONNECTED'`
3. Verifique se `access_token` não está expirado
4. Verifique se a loja tem `sistema_erp = 'TINY'`

---

## 📝 Notas Importantes

1. **Service Role Key:** ⚠️ MUITO SENSÍVEL - nunca exponha no frontend
2. **Intervalo:** 30 minutos é um bom equilíbrio (pode ajustar)
3. **Custo:** Edge Functions têm limite gratuito, depois há cobrança
4. **Monitoramento:** Acompanhe os logs regularmente

---

## 🎯 Próximos Passos Após Implementação

1. ✅ Monitorar logs por 24 horas
2. ✅ Ajustar intervalo se necessário (15min, 1h, etc.)
3. ✅ Configurar alertas (opcional)
4. ✅ Documentar para a equipe

---

## 📞 Suporte

Se tiver problemas, verifique:
- Logs da Edge Function
- Logs de sincronização no banco
- Status das integrações ERP

