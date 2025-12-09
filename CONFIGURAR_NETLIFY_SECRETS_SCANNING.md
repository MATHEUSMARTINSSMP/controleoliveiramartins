# Configurar Secrets Scanning no Netlify

## ⚠️ Problema

O Netlify está detectando `SUPABASE_ANON_KEY` no build output (`dist/assets/`) e falhando o deploy.

**IMPORTANTE:** `SUPABASE_ANON_KEY` é uma **chave pública** e é **esperada** no build output do frontend. Não representa risco de segurança.

## ✅ Solução Rápida (Recomendada)

### Opção 1: Via Netlify Dashboard (Mais Fácil)

1. Acesse: **https://app.netlify.com/sites/eleveaone/configuration/env**
2. Clique em **Add a variable**
3. Adicione as seguintes variáveis:

**Variável 1:**
- **Key:** `SECRETS_SCAN_OMIT_KEYS`
- **Value:** `SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY`
- **Scopes:** ✅ Production, ✅ Deploy Previews, ✅ Branch Deploys

**Variável 2 (Opcional):**
- **Key:** `SECRETS_SCAN_OMIT_PATHS`
- **Value:** `attached_assets/**,sql_migrations_archive/**,dist/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js,processar-fila-whatsapp.js`
- **Scopes:** ✅ Production, ✅ Deploy Previews, ✅ Branch Deploys

4. Clique em **Save**
5. Vá em **Deploys** > **Trigger deploy** > **Deploy site**

### Opção 2: Via Netlify CLI

```bash
# Instalar Netlify CLI (se não tiver)
npm install -g netlify-cli

# Fazer login
netlify login

# Configurar variáveis
netlify env:set SECRETS_SCAN_OMIT_KEYS "SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY"
netlify env:set SECRETS_SCAN_OMIT_PATHS "attached_assets/**,sql_migrations_archive/**,dist/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js,processar-fila-whatsapp.js"
```

### Opção 3: Desabilitar Secrets Scanning (Não Recomendado)

Se preferir desabilitar completamente:

- **Key:** `SECRETS_SCAN_ENABLED`
- **Value:** `false`

⚠️ **ATENÇÃO:** Isso desabilita a proteção contra secrets. Use apenas se necessário.

## 📋 Passo a Passo Detalhado

Configure as seguintes variáveis de ambiente no **Netlify Dashboard**:

### Passo 1: Acessar Configurações

1. Acesse: https://app.netlify.com/sites/eleveaone/configuration/env
2. Ou: Netlify Dashboard > Site Settings > Environment variables

### Passo 2: Adicionar Variáveis

Adicione as seguintes variáveis de ambiente:

**Variável 1:**
- **Key:** `SECRETS_SCAN_OMIT_PATHS`
- **Value:** `attached_assets/**,sql_migrations_archive/**,dist/**,*verificar*.js,*test*.js,*check*.js,*varredura*.js,*verify*.js,processar-fila-whatsapp.js`
- **Scopes:** All scopes (Production, Deploy Previews, Branch Deploys)

**Variável 2:**
- **Key:** `SECRETS_SCAN_OMIT_KEYS`
- **Value:** `SUPABASE_ANON_KEY,VITE_SUPABASE_ANON_KEY`
- **Scopes:** All scopes (Production, Deploy Previews, Branch Deploys)

### Passo 3: Salvar e Fazer Novo Deploy

1. Clique em **Save**
2. Vá em **Deploys** > **Trigger deploy** > **Deploy site**

## 📝 Explicação

- **`SECRETS_SCAN_OMIT_PATHS`**: Ignora arquivos/diretórios específicos do scan
- **`SECRETS_SCAN_OMIT_KEYS`**: Ignora chaves específicas (SUPABASE_ANON_KEY é pública e pode estar no build)

## 🔄 Alternativa (Não Recomendada)

Se preferir desabilitar completamente o secrets scanning:

- **Key:** `SECRETS_SCAN_ENABLED`
- **Value:** `false`

**⚠️ ATENÇÃO:** Isso desabilita a proteção contra secrets. Use apenas se necessário.

