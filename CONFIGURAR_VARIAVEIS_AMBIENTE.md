# 🔧 Guia Completo: Configuração de Variáveis de Ambiente

## 📋 Visão Geral

Este guia mostra como configurar todas as variáveis de ambiente necessárias para o sistema funcionar corretamente.

---

## 1️⃣ SUPABASE - Edge Functions (sync-tiny-orders)

### Onde configurar:
**Dashboard:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/settings/functions

### Variáveis necessárias:

#### ✅ Passo a Passo:

1. **Acesse o Dashboard do Supabase:**
   - Vá para: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc
   - No menu lateral, clique em **"Settings"** (⚙️)
   - Depois clique em **"Edge Functions"**

2. **Adicione as variáveis:**

   | Nome da Variável | Valor | Onde Encontrar |
   |-----------------|-------|----------------|
   | `SUPABASE_URL` | `https://kktsbnrnlnzyofupegjc.supabase.co` | ⚠️ **Já configurado automaticamente** - Não precisa adicionar |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | 🔑 **Settings > API > service_role key** (secret) |
   | `NETLIFY_FUNCTION_URL` | `https://eleveaone.com.br` | 🌐 URL do seu site Netlify |

3. **Como adicionar cada variável:**
   - Clique em **"Add a new secret"** ou **"Add new variable"**
   - Digite o **nome** da variável
   - Cole o **valor**
   - Clique em **"Save"** ou **"Add"**

### 🔑 Onde encontrar `SUPABASE_SERVICE_ROLE_KEY`:

1. No Dashboard do Supabase, vá em **Settings > API**
2. Role até a seção **"Project API keys"**
3. Encontre **"service_role"** (⚠️ **SECRET** - não compartilhe!)
4. Clique em **"Reveal"** ou **"Show"** para ver a chave completa
5. **Copie toda a chave** (começa com `eyJhbGc...`)

⚠️ **IMPORTANTE:** A `service_role` key tem **acesso total** ao banco de dados, sem restrições de RLS. Mantenha segura!

---

## 2️⃣ NETLIFY - Site Settings (Functions)

### Onde configurar:
**Dashboard:** https://app.netlify.com/sites/[SEU_SITE]/configuration/env

### Variáveis necessárias:

#### ✅ Passo a Passo:

1. **Acesse o Dashboard do Netlify:**
   - Vá para: https://app.netlify.com
   - Selecione seu site (provavelmente `eleveaone` ou similar)
   - No menu lateral, clique em **"Site configuration"**
   - Depois clique em **"Environment variables"**

2. **Adicione as variáveis:**

   | Nome da Variável | Valor | Onde Encontrar |
   |-----------------|-------|----------------|
   | `VITE_SUPABASE_URL` | `https://kktsbnrnlnzyofupegjc.supabase.co` | 🗄️ Dashboard Supabase > Settings > API > Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | 🔑 Dashboard Supabase > Settings > API > service_role key |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | 🔑 Dashboard Supabase > Settings > API > anon/public key |
   | `URL` | `https://eleveaone.com.br` | ⚠️ **Já configurado automaticamente** pelo Netlify (verificar se está correto) |

3. **Como adicionar cada variável:**
   - Clique em **"Add a variable"** ou **"Add environment variable"**
   - Digite o **nome** da variável
   - Cole o **valor**
   - Escolha o **context** (geralmente "Production" e "All")
   - Clique em **"Save"**

### 🔑 Onde encontrar as chaves do Supabase:

**Para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`:**
1. No Dashboard do Supabase, vá em **Settings > API**
2. Na seção **"Project URL"** você encontra a URL
3. Na seção **"Project API keys"** você encontra:
   - **anon/public** - Chave pública (pode ser exposta no frontend)
   - **service_role** - Chave secreta (apenas backend)

---

## 3️⃣ Verificação das Configurações

### ✅ Checklist - Supabase Edge Functions:

- [ ] `SUPABASE_URL` está configurado (ou é automático)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está configurada
- [ ] `NETLIFY_FUNCTION_URL` está configurada como `https://eleveaone.com.br`

### ✅ Checklist - Netlify:

- [ ] `VITE_SUPABASE_URL` está configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` está configurada
- [ ] `VITE_SUPABASE_ANON_KEY` está configurada
- [ ] `URL` está configurada (ou é automática)

---

## 4️⃣ Valores para Copiar e Colar

### 🗄️ Supabase - Valores do Seu Projeto:

```
SUPABASE_URL: https://kktsbnrnlnzyofupegjc.supabase.co
```

⚠️ **IMPORTANTE:** As chaves `SUPABASE_SERVICE_ROLE_KEY` e `VITE_SUPABASE_ANON_KEY` são **únicas do seu projeto**. Você precisa copiá-las do Dashboard do Supabase.

### 🌐 Netlify - Valores Fixos:

```
NETLIFY_FUNCTION_URL: https://eleveaone.com.br
URL: https://eleveaone.com.br
```

---

## 5️⃣ Troubleshooting

### ❌ Erro: "Failed to send a request to the Edge Function"
- ✅ Verifique se `NETLIFY_FUNCTION_URL` está configurada no Supabase
- ✅ Verifique se a Edge Function `sync-tiny-orders` está deployada

### ❌ Erro: "Token de acesso não encontrado"
- ✅ Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada
- ✅ Verifique se a chave está completa (começa com `eyJhbGc...`)

### ❌ Erro: "Configuração Supabase não encontrada"
- ✅ Verifique se `VITE_SUPABASE_URL` está configurada no Netlify
- ✅ Verifique se `SUPABASE_SERVICE_ROLE_KEY` está configurada no Netlify

### ❌ Erro: "Cannot connect to Netlify Function"
- ✅ Verifique se `NETLIFY_FUNCTION_URL` está correta no Supabase
- ✅ Verifique se o site está deployado no Netlify

---

## 6️⃣ Links Diretos

### Supabase Dashboard:
- **Edge Functions Settings:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/settings/functions
- **API Settings (para pegar as chaves):** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/settings/api

### Netlify Dashboard:
- **Environment Variables:** https://app.netlify.com/sites/[SEU_SITE]/configuration/env
  (Substitua `[SEU_SITE]` pelo nome do seu site)

---

## 7️⃣ Dicas Importantes

1. ⚠️ **Nunca compartilhe** a `SUPABASE_SERVICE_ROLE_KEY` publicamente
2. 🔄 Após adicionar variáveis no Netlify, pode ser necessário fazer um **redeploy**
3. 🔄 Após adicionar variáveis no Supabase Edge Functions, a função precisa ser **redeployada**
4. ✅ Sempre verifique se os valores estão **corretos** antes de salvar
5. 📝 Mantenha um backup seguro das chaves em um gerenciador de senhas

---

## 8️⃣ Próximos Passos Após Configurar

1. ✅ Deploy da Edge Function `sync-tiny-orders` (veja `DEPLOY_EDGE_FUNCTION.md`)
2. ✅ Testar uma sincronização manual
3. ✅ Verificar logs no Supabase Dashboard
4. ✅ Verificar logs no Netlify Dashboard

---

**🎉 Pronto! Após configurar todas as variáveis, o sistema estará totalmente funcional!**

