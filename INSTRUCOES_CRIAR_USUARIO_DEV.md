# 🔐 Instruções - Criar Usuário Dev

## 📋 Objetivo
Criar usuário `dev@dev.com` com senha `123456` para acessar o painel dev (`/dev/*`).

---

## 🎯 Passo a Passo

### 1️⃣ Criar Usuário no Supabase Auth

1. Acesse: **Supabase Dashboard** → **Authentication** → **Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha:
   - **Email:** `dev@dev.com`
   - **Password:** `123456`
   - **Auto Confirm User:** ✅ **Sim** (marcar)
4. Clique em **"Create user"**

---

### 2️⃣ Criar Profile no Banco

Após criar o usuário no Auth, execute no **SQL Editor** do Supabase:

```sql
SELECT create_dev_user_profile();
```

**OU** execute a migration completa:
```sql
-- Executar migration: 20250127050000_create_dev_user.sql
```

---

### 3️⃣ Verificar

Execute para verificar se está tudo certo:

```sql
SELECT 
    u.email,
    p.name,
    p.role,
    p.active
FROM auth.users u
LEFT JOIN sistemaretiradas.profiles p ON p.id = u.id
WHERE u.email = 'dev@dev.com';
```

**Resultado esperado:**
```
email          | name           | role  | active
---------------|----------------|-------|--------
dev@dev.com    | Desenvolvedor  | ADMIN | true
```

---

## ✅ Teste de Acesso

1. Acesse: `https://eleveaone.com.br/dev/login`
2. Faça login com:
   - **Email:** `dev@dev.com`
   - **Senha:** `123456`
3. Deve redirecionar para `/dev/erp-config`

---

## 🔒 Segurança

- ✅ Apenas `dev@dev.com` pode acessar `/dev/*`
- ✅ Verificação no frontend e backend
- ✅ Usuário tem role `ADMIN` (acesso total ao sistema)
- ✅ Isolado do login normal (`/`)

---

## 🆘 Troubleshooting

### Erro: "Usuário não encontrado"
- Verifique se criou o usuário no Supabase Auth
- Confirme que o email é exatamente `dev@dev.com`

### Erro: "Profile não encontrado"
- Execute: `SELECT create_dev_user_profile();`
- Verifique se a migration foi executada

### Erro: "Acesso restrito"
- Verifique se o email logado é exatamente `dev@dev.com`
- Verifique se o profile tem `role = 'ADMIN'`

---

**Pronto!** 🎉

