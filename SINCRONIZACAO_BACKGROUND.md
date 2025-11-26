# Sincronização em Background (Página Fechada)

## 📋 Situação Atual

**Problema:** A sincronização automática atual para quando a página é fechada.

**Por quê?**
- A sincronização usa `setInterval` no frontend (navegador)
- Quando você fecha a página, o JavaScript para de executar
- Não há processo em background continuando a sincronização

## ✅ Soluções Possíveis

### Opção 1: Supabase Edge Functions + pg_cron (Recomendado)

**Vantagens:**
- ✅ Roda no servidor (Supabase)
- ✅ Funciona 24/7, mesmo com página fechada
- ✅ Integrado com o banco de dados
- ✅ Gratuito até certo limite

**Como funciona:**
1. Criar uma Edge Function que sincroniza pedidos
2. Usar `pg_cron` (extensão PostgreSQL) para agendar execuções
3. Executar a cada X minutos/horas automaticamente

**Implementação:**
```sql
-- Agendar sincronização a cada 30 minutos
SELECT cron.schedule(
  'sync-tiny-orders',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url := 'https://seu-projeto.supabase.co/functions/v1/sync-tiny-orders',
    headers := '{"Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

### Opção 2: Netlify Scheduled Functions

**Vantagens:**
- ✅ Roda no servidor (Netlify)
- ✅ Funciona 24/7
- ✅ Integrado com o deploy

**Como funciona:**
1. Criar uma Netlify Function
2. Configurar schedule no `netlify.toml`
3. Executar automaticamente

**Implementação:**
```toml
# netlify.toml
[[plugins]]
package = "@netlify/plugin-scheduled-functions"

[[schedules]]
cron = "*/30 * * * *" # A cada 30 minutos
function = "sync-tiny-orders"
```

---

### Opção 3: Webhooks do Tiny ERP (Ideal, se disponível)

**Vantagens:**
- ✅ Sincronização em tempo real
- ✅ Não precisa fazer polling
- ✅ Mais eficiente

**Como funciona:**
1. Tiny ERP envia notificação quando há nova venda
2. Nossa API recebe o webhook
3. Sincroniza apenas o pedido novo

**Implementação:**
- Verificar se Tiny ERP oferece webhooks
- Criar endpoint para receber notificações
- Processar apenas o pedido recebido

---

## 🚀 Recomendação: Opção 1 (Supabase Edge Functions)

### Por quê?
- Já usamos Supabase
- Integração mais simples
- Controle total sobre quando executar
- Pode sincronizar múltiplas lojas

### Implementação Passo a Passo

#### 1. Criar Edge Function
```typescript
// supabase/functions/sync-tiny-orders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Buscar todas as lojas com integração ativa
  // Para cada loja, sincronizar pedidos
  // Retornar resultado
})
```

#### 2. Agendar com pg_cron
```sql
-- Habilitar extensão
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar sincronização
SELECT cron.schedule(
  'sync-tiny-orders-every-30min',
  '*/30 * * * *', -- A cada 30 minutos
  $$
  SELECT net.http_post(
    url := 'https://seu-projeto.supabase.co/functions/v1/sync-tiny-orders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);
```

#### 3. Configurar Service Role Key
- Usar Service Role Key (não anon key) para autenticação
- Armazenar em Supabase Secrets

---

## 📊 Comparação das Opções

| Opção | Complexidade | Custo | Tempo Real | Recomendado |
|-------|--------------|-------|------------|-------------|
| **Supabase Edge Functions** | Média | Gratuito* | ⚠️ Polling | ✅ Sim |
| **Netlify Scheduled Functions** | Baixa | Gratuito* | ⚠️ Polling | ✅ Sim |
| **Webhooks Tiny ERP** | Alta | Gratuito | ✅ Real | ⚠️ Se disponível |

*Gratuito até certo limite de execuções

---

## 🔧 Implementação Rápida (Opção 1)

Quer que eu implemente a Opção 1 (Supabase Edge Functions + pg_cron)?

**O que será criado:**
1. Edge Function para sincronização
2. SQL para agendar execução
3. Documentação de configuração

**Resultado:**
- ✅ Sincronização automática a cada 30 minutos
- ✅ Funciona mesmo com página fechada
- ✅ Sincroniza todas as lojas com integração ativa

---

## 📝 Notas

- A sincronização atual (frontend) continua funcionando quando a página está aberta
- A sincronização em background seria adicional, não substitui a atual
- Pode configurar intervalo (ex: 15min, 30min, 1h)

