# ⚡ Solução Rápida - Erro de Secrets no Netlify

## 🎯 Problema
Netlify detecta `SUPABASE_ANON_KEY` no build output e bloqueia o deploy.

## ✅ Solução em 3 Passos

### 1️⃣ Acesse o Netlify Dashboard
👉 **https://app.netlify.com/sites/eleveaone/configuration/env**

### 2️⃣ Adicione ESTAS 2 Variáveis de Ambiente

**Variável 1:**
```
Key: SECRETS_SCAN_OMIT_KEYS
Value: SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY
Scopes: ✅ Production ✅ Deploy Previews ✅ Branch Deploys
```

**Variável 2:**
```
Key: SECRETS_SCAN_OMIT_PATHS  
Value: dist/**,attached_assets/**,sql_migrations_archive/**
Scopes: ✅ Production ✅ Deploy Previews ✅ Branch Deploys
```

### 3️⃣ Salve e Faça Novo Deploy
1. Clique em **"Save"**
2. Vá em **"Deploys"** (menu lateral)
3. Clique em **"Trigger deploy"** > **"Deploy site"**

## 📸 Screenshot do que fazer:

1. No Netlify Dashboard, vá em **Site settings** > **Environment variables**
2. Clique em **"Add a variable"**
3. Cole exatamente os valores acima
4. Marque todos os scopes (Production, Deploy Previews, Branch Deploys)
5. Salve

## ⚠️ Importante

- `SUPABASE_ANON_KEY` é uma **chave pública** e **deve** estar no build
- Não representa risco de segurança
- O Netlify está sendo muito restritivo ao detectá-la

## 🔄 Se ainda não funcionar

Como última opção, desabilite o secrets scanning completamente:

```
Key: SECRETS_SCAN_ENABLED
Value: false
```

⚠️ **Use apenas se necessário** - isso desabilita a proteção contra secrets reais.

