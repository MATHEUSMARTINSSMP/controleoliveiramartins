# Configurar Secrets Scanning no Netlify

## ⚠️ Problema

O Netlify está detectando `SUPABASE_ANON_KEY` no build output e falhando o deploy.

## ✅ Solução

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

