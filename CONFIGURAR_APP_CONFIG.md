# 🔐 CONFIGURAR APP_CONFIG NO SUPABASE

## ⚠️ IMPORTANTE

As migrations agora buscam as chaves da tabela `app_config` ao invés de ter valores hardcoded.

**Você precisa configurar as chaves antes de executar as migrations!**

---

## 📋 PASSO A PASSO

### 1. Acessar Supabase SQL Editor
- Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new

### 2. Executar Migration da Tabela app_config (se ainda não executou)
```sql
-- Execute primeiro esta migration se ainda não tiver a tabela:
-- supabase/migrations/20250129000001_create_app_config_table.sql
```

### 3. Inserir Configurações
```sql
-- Inserir URL do Supabase
INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES (
  'supabase_url',
  'https://kktsbnrnlnzyofupegjc.supabase.co',
  'URL do projeto Supabase'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Inserir Service Role Key (SUBSTITUA PELA SUA CHAVE REAL)
INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES (
  'supabase_service_role_key',
  'SUA_SERVICE_ROLE_KEY_AQUI',  -- ⚠️ SUBSTITUA PELA CHAVE REAL
  'Service Role Key do Supabase para chamar Edge Functions via pg_cron'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 4. Verificar Configurações
```sql
-- Verificar se as configurações foram inseridas
SELECT key, 
       CASE 
         WHEN key = 'supabase_service_role_key' THEN '***OCULTO***'
         ELSE value 
       END as value,
       description
FROM sistemaretiradas.app_config
WHERE key IN ('supabase_url', 'supabase_service_role_key');
```

---

## 🔑 ONDE ENCONTRAR A SERVICE ROLE KEY

1. Acesse: Supabase Dashboard > Settings > API
2. Procure por "service_role" (secret)
3. Copie a chave completa
4. Cole no INSERT acima

---

## ✅ APÓS CONFIGURAR

Agora você pode executar as migrations:
- `supabase/migrations/20250130000000_setup_sync_cron_completo.sql`
- `supabase/migrations/20250130000001_fix_tiny_orders_unique_constraint.sql`

Elas vão buscar as chaves da tabela `app_config` automaticamente!

---

## 🔒 SEGURANÇA

- ✅ Chaves não estão mais hardcoded no código
- ✅ Chaves armazenadas na tabela `app_config` (protegida por RLS)
- ✅ Apenas ADMIN pode ver/editar configurações
- ✅ Netlify não detecta mais chaves expostas

