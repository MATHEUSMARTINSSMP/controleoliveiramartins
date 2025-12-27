# ✅ Correções de RLS Policies - Google My Business

## 🔴 Problema Identificado

**Erro:** `permission denied for table users` (código 42501)

**Causa:** As RLS policies das tabelas Google estavam tentando acessar `auth.users` para obter o email do usuário:
```sql
customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
```

O cliente `anon` (usado pelo frontend) **não tem permissão** para ler a tabela `auth.users`, resultando em erro 403.

---

## ✅ Solução Aplicada

Substituir o acesso a `auth.users` pelo email da tabela `profiles`:

**Antes:**
```sql
customer_id = (SELECT email FROM auth.users WHERE id = auth.uid())
```

**Depois:**
```sql
customer_id = p.email  -- onde p vem do JOIN com profiles
```

---

## 📋 Migrations Criadas

### 1. `20251227000002_fix_google_credentials_rls_auth_users.sql`
- Corrige RLS policies da tabela `google_credentials`
- Policies: SELECT e ALL (gerenciamento)

### 2. `20251227000003_fix_google_reviews_rls_auth_users.sql`
- Corrige RLS policies da tabela `google_reviews`
- Policies: SELECT e ALL (gerenciamento)

### 3. `20251227000004_fix_google_business_accounts_rls_auth_users.sql`
- Corrige RLS policies da tabela `google_business_accounts`
- Policies: SELECT e ALL (gerenciamento)

### 4. `20251227000005_fix_google_reply_history_rls_auth_users.sql`
- Corrige RLS policies da tabela `google_reply_history`
- Policies: SELECT e INSERT

### 5. `20251227000006_fix_google_settings_rls_auth_users.sql`
- Corrige RLS policies da tabela `google_settings`
- Policies: SELECT, UPDATE e INSERT

---

## 🔧 Como Aplicar as Correções

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o SQL Editor do Supabase
2. Execute cada migration na ordem:
   - `20251227000002_fix_google_credentials_rls_auth_users.sql`
   - `20251227000003_fix_google_reviews_rls_auth_users.sql`
   - `20251227000004_fix_google_business_accounts_rls_auth_users.sql`
   - `20251227000005_fix_google_reply_history_rls_auth_users.sql`
   - `20251227000006_fix_google_settings_rls_auth_users.sql`

### Opção 2: Via CLI do Supabase

```bash
supabase migration up
```

---

## ✅ Verificação

Após aplicar as migrations, verificar se o erro desapareceu:

1. Acessar `/admin/marketing` (aba Google)
2. Verificar console do navegador - não deve mais aparecer erro 42501
3. Verificar se as credenciais Google podem ser lidas corretamente

---

## 📝 Nota Importante

**Callback OAuth (`google-oauth-callback.js`):**
- ✅ Usa `service_role_key` → **bypassa RLS** → Pode salvar normalmente
- ✅ Não precisa de correção (já está funcionando)

**Frontend (hooks/components):**
- ✅ Agora funciona corretamente após aplicar migrations
- ✅ Usa cliente `anon` que precisa das RLS policies corrigidas

---

**Status:** ✅ Migrations criadas e commitadas  
**Próximo passo:** Executar migrations no banco de dados

