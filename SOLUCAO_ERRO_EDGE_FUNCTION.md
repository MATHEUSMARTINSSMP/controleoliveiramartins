# 🔧 SOLUÇÃO: Erro "Failed to send a request to the Edge Function"

## 🔴 PROBLEMA

O erro "Failed to send a request to the Edge Function" aparece quando:
- A Edge Function **não está deployada** no Supabase
- A função não existe ou o nome está incorreto
- Problema de CORS ou autenticação

## ✅ CORREÇÃO APLICADA

### 1. Código Atualizado
- ✅ `ForgotPassword.tsx` agora usa `fetch` direto ao invés de `supabase.functions.invoke()`
- ✅ Tratamento de erros melhorado
- ✅ Mensagens de erro mais descritivas

### 2. Ação Necessária: DEPLOY DA EDGE FUNCTION

**A Edge Function `request-password-reset` precisa estar deployada no Supabase!**

## 🚀 COMO DEPLOYAR

### Opção 1: Via Supabase Dashboard (Mais Fácil)

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
2. Clique em **"Create a new function"**
3. Configure:
   - **Function name:** `request-password-reset`
   - **Copy code from:** `supabase/functions/request-password-reset/index.ts`
4. Clique em **"Deploy"**

### Opção 2: Via Supabase CLI

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref kktsbnrnlnzyofupegjc

# Deploy
supabase functions deploy request-password-reset
```

## 🔑 CONFIGURAR VARIÁVEIS DE AMBIENTE

Após deploy, configure os secrets:

1. Vá em: **Project Settings > Edge Functions > Secrets**
2. Adicione:
   - **RESEND_API_KEY** = `re_LGPMbE4N_7VGxWn33BAFzD6s3AjYeadbA`

## ✅ VERIFICAR SE FUNCIONOU

Após deploy, teste:

1. Abra o console do navegador (F12)
2. Tente recuperar senha novamente
3. Verifique os logs no console
4. Se ainda der erro, verifique os logs da Edge Function no Supabase Dashboard

## 📋 TODAS AS FUNÇÕES QUE PRECISAM DE DEPLOY

1. ⚠️ `request-password-reset` - **URGENTE** (recuperação de senha)
2. ⚠️ `create-colaboradora` - Criar colaboradora
3. ⚠️ `reset-colaboradora-password` - Resetar senha (admin)
4. ⚠️ `send-welcome-email` - Email de boas-vindas
5. ⚠️ `send-password-reset-email` - Email de reset

## 🎯 PRÓXIMOS PASSOS

1. **DEPLOY** a função `request-password-reset` no Supabase
2. **CONFIGURAR** a variável `RESEND_API_KEY` nos secrets
3. **TESTAR** a recuperação de senha novamente

---

**Status:** ✅ Código corrigido, aguardando deploy da Edge Function

