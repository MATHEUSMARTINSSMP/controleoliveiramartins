# 🚀 INSTRUÇÕES PARA DEPLOY DAS EDGE FUNCTIONS

## ⚠️ IMPORTANTE

O erro "Failed to send a request to the Edge Function" geralmente significa que a Edge Function **não está deployada** no Supabase.

## 📋 COMO DEPLOYAR AS EDGE FUNCTIONS

### Opção 1: Via Supabase CLI (Recomendado)

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Linkar com seu projeto
supabase link --project-ref kktsbnrnlnzyofupegjc

# Deploy de todas as funções
supabase functions deploy request-password-reset
supabase functions deploy create-colaboradora
supabase functions deploy reset-colaboradora-password
supabase functions deploy send-welcome-email
supabase functions deploy send-password-reset-email
```

### Opção 2: Via Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
2. Clique em "Create a new function"
3. Para cada função:
   - Nome: `request-password-reset`
   - Cole o conteúdo do arquivo `index.ts`
   - Clique em "Deploy"

## 🔑 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

Certifique-se de que as seguintes variáveis estão configuradas no Supabase:

1. **RESEND_API_KEY**
   - Vá em: Project Settings > Edge Functions > Secrets
   - Adicione: `RESEND_API_KEY` = `[Obtenha no Resend Dashboard > API Keys]`

2. **SUPABASE_URL** (já configurado automaticamente)
3. **SUPABASE_SERVICE_ROLE_KEY** (já configurado automaticamente)
4. **SUPABASE_ANON_KEY** (já configurado automaticamente)

## ✅ VERIFICAR SE ESTÁ FUNCIONANDO

Após deploy, teste a função:

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/request-password-reset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -d '{"identifier": "matheusmartinss@icloud.com"}'
```

## 🔍 FUNÇÕES QUE PRECISAM DE DEPLOY

1. ✅ `request-password-reset` - Recuperação de senha
2. ✅ `create-colaboradora` - Criar colaboradora
3. ✅ `reset-colaboradora-password` - Resetar senha (admin)
4. ✅ `send-welcome-email` - Email de boas-vindas
5. ✅ `send-password-reset-email` - Email de reset de senha

## 📝 NOTA

O código foi atualizado para usar `fetch` direto ao invés de `supabase.functions.invoke()`, o que é mais confiável. Mas as funções ainda precisam estar deployadas no Supabase.

