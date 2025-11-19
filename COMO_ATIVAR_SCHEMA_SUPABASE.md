# 🔧 COMO ATIVAR O SCHEMA NO SUPABASE

## 📋 PASSO A PASSO COMPLETO

### 1️⃣ EXPOR O SCHEMA NO PAINEL DO SUPABASE

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc

2. **Vá em Project Settings:**
   - No menu lateral esquerdo, clique em **⚙️ Settings** (Configurações)
   - Depois clique em **API**

3. **Configure os Schemas Expostos:**
   - Procure pela seção **"Exposed schemas"** ou **"Schemas"**
   - Adicione o schema `sacadaohboy-mrkitsch-loungerie` à lista
   - Se não encontrar essa opção, vá para o passo 2 (SQL)

---

### 2️⃣ CONCEDER PERMISSÕES VIA SQL (RECOMENDADO)

1. **Acesse o SQL Editor:**
   - No menu lateral, clique em **SQL Editor**
   - Ou acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/sql/new

2. **Execute este script SQL:**

```sql
-- ============================================
-- ATIVAR SCHEMA: sacadaohboy-mrkitsch-loungerie
-- ============================================

-- 1. Garantir que o schema existe
CREATE SCHEMA IF NOT EXISTS "sacadaohboy-mrkitsch-loungerie";

-- 2. Conceder permissões de USAGE aos papéis do Supabase
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 3. Conceder permissões em todas as tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 4. Conceder permissões em todas as funções/rotinas
GRANT ALL ON ALL ROUTINES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 5. Conceder permissões em todas as sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon, authenticated, service_role;

-- 6. Configurar permissões padrão para tabelas futuras
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 7. Configurar permissões padrão para funções futuras
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 8. Configurar permissões padrão para sequences futuras
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================
-- VERIFICAR PERMISSÕES
-- ============================================

-- Verificar se o schema existe
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'sacadaohboy-mrkitsch-loungerie';

-- Verificar permissões do schema
SELECT 
  nspname as schema_name,
  rolname as role_name,
  nspacl as permissions
FROM pg_namespace
JOIN pg_roles ON true
WHERE nspname = 'sacadaohboy-mrkitsch-loungerie';
```

3. **Clique em "Run"** para executar o script

---

### 3️⃣ CONFIGURAR NO SUPABASE CONFIG (SE USAR SUPABASE CLI)

Se você usa Supabase CLI localmente, edite o arquivo `supabase/config.toml`:

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "sacadaohboy-mrkitsch-loungerie", "elevea"]
extra_search_path = ["public", "sacadaohboy-mrkitsch-loungerie"]
```

---

### 4️⃣ VERIFICAR SE FUNCIONOU

Execute este teste no SQL Editor:

```sql
-- Teste 1: Verificar se consegue acessar o schema
SELECT * FROM "sacadaohboy-mrkitsch-loungerie".profiles LIMIT 1;

-- Teste 2: Verificar permissões
SELECT 
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND grantee IN ('anon', 'authenticated', 'service_role');
```

---

### 5️⃣ TESTAR VIA API

Após configurar, teste a função novamente:

1. Acesse: https://controleinterno.netlify.app/forgot-password
2. Digite o email: `matheusmartinss@icloud.com`
3. Verifique se funciona sem erro de schema

---

## ⚠️ IMPORTANTE

### Por que o Supabase restringe schemas?

O Supabase por padrão só expõe o schema `public` via API por segurança. Schemas customizados precisam ser explicitamente expostos e ter permissões concedidas.

### Schemas permitidos

Após configurar, o Supabase permitirá acesso a:
- ✅ `public` (padrão)
- ✅ `elevea` (já configurado)
- ✅ `sacadaohboy-mrkitsch-loungerie` (após configurar)

---

## 🔍 ONDE ENCONTRAR NO DASHBOARD

### Opção 1: Project Settings > API
1. Dashboard → ⚙️ Settings → API
2. Procure por "Exposed schemas" ou "Additional schemas"
3. Adicione: `sacadaohboy-mrkitsch-loungerie`

### Opção 2: SQL Editor (Mais Confiável)
1. Dashboard → SQL Editor
2. Cole o script SQL acima
3. Execute

---

## 📝 NOTAS

- As permissões são concedidas aos papéis:
  - `anon`: usuários não autenticados
  - `authenticated`: usuários autenticados
  - `service_role`: chave de serviço (SERVICE_ROLE_KEY)

- Após executar o SQL, pode levar alguns segundos para as mudanças serem aplicadas

- Se ainda não funcionar, verifique se o schema realmente existe:
  ```sql
  SELECT * FROM information_schema.schemata 
  WHERE schema_name = 'sacadaohboy-mrkitsch-loungerie';
  ```

---

## ✅ CHECKLIST

- [ ] Schema criado (se não existir)
- [ ] Permissões USAGE concedidas
- [ ] Permissões em tabelas concedidas
- [ ] Permissões em funções concedidas
- [ ] Permissões em sequences concedidas
- [ ] Permissões padrão configuradas
- [ ] Teste SQL executado com sucesso
- [ ] Teste via API funcionando

---

## 🆘 SE AINDA NÃO FUNCIONAR

1. Verifique os logs da função no Netlify
2. Verifique se o schema existe no banco
3. Tente usar o schema `elevea` ou `public` temporariamente
4. Verifique se a SERVICE_ROLE_KEY tem permissões suficientes

