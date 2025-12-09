# 🚨 Resolver Erro de Secrets no Netlify

## ❌ Problema

O Netlify está bloqueando o deploy porque detecta `SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY` nos arquivos de build (`dist/assets/*.js`).

## ✅ Solução Rápida (Escolha UMA opção)

### Opção 1: Script Automático (Mais Fácil) ⚡

```bash
bash configurar-netlify-secrets.sh
```

Isso configura automaticamente as variáveis de ambiente no Netlify via CLI.

### Opção 2: Manual no Dashboard 🌐

1. Acesse: **https://app.netlify.com/sites/eleveaone/configuration/env**
2. Clique em **"Add a variable"**
3. Adicione estas 2 variáveis:

**Variável 1:**
- **Key:** `SECRETS_SCAN_OMIT_KEYS`
- **Value:** `SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY,VITE_SUPABASE_PUBLISHABLE_KEY`
- **Scopes:** ✅ Production ✅ Deploy Previews ✅ Branch Deploys

**Variável 2:**
- **Key:** `SECRETS_SCAN_OMIT_PATHS`
- **Value:** `dist/**`
- **Scopes:** ✅ Production ✅ Deploy Previews ✅ Branch Deploys

4. Clique em **"Save"**
5. Vá em **Deploys** > **Trigger deploy** > **Deploy site**

### Opção 3: Desabilitar Secrets Scanning (Não Recomendado) ⚠️

Se as opções acima não funcionarem:

1. Acesse: **https://app.netlify.com/sites/eleveaone/configuration/env**
2. Adicione:
   - **Key:** `SECRETS_SCAN_ENABLED`
   - **Value:** `false`
   - **Scopes:** ✅ Production ✅ Deploy Previews ✅ Branch Deploys

⚠️ **Atenção:** Isso desabilita a proteção contra secrets reais. Use apenas se necessário.

## 🔍 Por Que Isso Acontece?

- O Vite substitui `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` pelo valor real no build
- Isso é **NORMAL** e **NECESSÁRIO** - o frontend precisa dessa chave para funcionar
- `VITE_SUPABASE_PUBLISHABLE_KEY` é uma **chave pública** (não é um secret)
- O Netlify está sendo muito restritivo ao detectá-la

## ✅ Após Configurar

O próximo deploy deve funcionar normalmente. A chave continuará no build (como deve ser), mas o Netlify não vai mais bloquear o deploy.

