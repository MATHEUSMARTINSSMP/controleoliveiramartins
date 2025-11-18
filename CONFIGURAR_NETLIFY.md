# 🔧 CONFIGURAR VARIÁVEIS DE AMBIENTE NO NETLIFY

## ⚠️ IMPORTANTE

O erro 502 nas Netlify Functions geralmente significa que as **variáveis de ambiente não estão configuradas** no Netlify.

## 📋 VARIÁVEIS NECESSÁRIAS

Configure as seguintes variáveis no Netlify Dashboard:

1. Acesse: https://app.netlify.com/sites/controleinterno/settings/deploys#environment-variables

2. Adicione as seguintes variáveis:

### Variáveis Obrigatórias:

- **SUPABASE_URL**
  - Valor: `https://kktsbnrnlnzyofupegjc.supabase.co`
  
- **SUPABASE_SERVICE_ROLE_KEY**
  - Valor: (sua chave de service role do Supabase)
  - Onde encontrar: Supabase Dashboard > Project Settings > API > service_role key

- **RESEND_API_KEY**
  - Valor: `re_LGPMbE4N_7VGxWn33BAFzD6s3AjYeadbA`

### Variáveis Opcionais (para chamadas internas):

- **NETLIFY_URL** (configurado automaticamente pelo Netlify)
- **DEPLOY_PRIME_URL** (configurado automaticamente pelo Netlify)

## ✅ COMO CONFIGURAR

1. Acesse o Netlify Dashboard
2. Vá em: **Site settings > Environment variables**
3. Clique em **Add a variable**
4. Adicione cada variável acima
5. **IMPORTANTE:** Marque como **"Deploy to production"** para todas
6. Salve as alterações

## 🔄 APÓS CONFIGURAR

1. Faça um novo deploy (ou aguarde o próximo deploy automático)
2. Teste a função novamente
3. Verifique os logs em: **Functions > request-password-reset > Logs**

## 🐛 VERIFICAR LOGS

Se ainda der erro, verifique os logs:

1. Acesse: https://app.netlify.com/sites/controleinterno/functions
2. Clique em `request-password-reset`
3. Veja os logs para identificar o erro específico

## 📝 NOTA

As variáveis de ambiente são necessárias para:
- Conectar ao Supabase (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`)
- Enviar emails via Resend (`RESEND_API_KEY`)

