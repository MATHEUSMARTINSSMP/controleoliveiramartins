# 🚀 Criar Usuário Dev - Método Rápido

## ✅ Opção 1: Via Edge Function (RECOMENDADO)

### 1. Deploy da Edge Function

A Edge Function `create-dev-user` já está criada. Faça o deploy:

```bash
# No terminal do projeto
supabase functions deploy create-dev-user
```

### 2. Executar via cURL ou Postman

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/create-dev-user \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**OU** acesse diretamente no navegador (após deploy):
```
https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/create-dev-user
```

---

## ✅ Opção 2: Via Supabase Dashboard (MANUAL)

### 1. Criar Usuário no Auth

1. Acesse: **Supabase Dashboard** → **Authentication** → **Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha:
   - **Email:** `dev@dev.com`
   - **Password:** `123456`
   - **Auto Confirm User:** ✅ **Sim**
4. Clique em **"Create user"**

### 2. Criar Profile (SQL Editor)

Após criar o usuário, execute no **SQL Editor**:

```sql
SELECT create_dev_user_profile();
```

---

## ✅ Opção 3: Via SQL Direto (Service Role)

Execute no SQL Editor com Service Role Key:

```sql
-- Criar usuário (requer Service Role)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Criar usuário no auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'dev@dev.com',
        crypt('123456', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_user_id;

    -- Se criou usuário, criar profile
    IF v_user_id IS NOT NULL THEN
        INSERT INTO sistemaretiradas.profiles (
            id,
            name,
            email,
            role,
            active,
            limite_total,
            limite_mensal
        )
        VALUES (
            v_user_id,
            'Desenvolvedor',
            'dev@dev.com',
            'ADMIN',
            true,
            999999.00,
            999999.00
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'ADMIN',
            active = true;
    END IF;
END;
$$;
```

**⚠️ NOTA:** Este método pode não funcionar dependendo das permissões. Use a Opção 1 ou 2.

---

## ✅ Verificação

Após criar, verifique:

```sql
SELECT 
    u.email,
    u.email_confirmed_at,
    p.name,
    p.role,
    p.active
FROM auth.users u
LEFT JOIN sistemaretiradas.profiles p ON p.id = u.id
WHERE u.email = 'dev@dev.com';
```

**Resultado esperado:**
```
email          | email_confirmed_at | name           | role  | active
---------------|-------------------|----------------|-------|--------
dev@dev.com    | 2025-01-27 ...    | Desenvolvedor  | ADMIN | true
```

---

## 🎯 Teste de Login

1. Acesse: `https://eleveaone.com.br/dev/login`
2. Login:
   - **Email:** `dev@dev.com`
   - **Senha:** `123456`
3. Deve redirecionar para `/dev/erp-config`

---

**Recomendação:** Use a **Opção 1** (Edge Function) - é a mais rápida e confiável! 🚀

