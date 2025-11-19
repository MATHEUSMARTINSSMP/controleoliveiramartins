# 📋 COPIAR E COLAR - VARIÁVEIS DE AMBIENTE NETLIFY

## 🚀 PASSO A PASSO RÁPIDO

1. Acesse: https://app.netlify.com/sites/controleinterno/settings/deploys#environment-variables
2. Para cada variável abaixo, clique em **"Add a variable"** e cole:

---

## ✅ VARIÁVEL 1: SUPABASE_URL

**Nome da variável:**
```
SUPABASE_URL
```

**Valor:**
```
https://kktsbnrnlnzyofupegjc.supabase.co
```

✅ Marque: **"Deploy to production"**

---

## ✅ VARIÁVEL 2: SUPABASE_SERVICE_ROLE_KEY

**Nome da variável:**
```
SUPABASE_SERVICE_ROLE_KEY
```

**Valor:**
```
[Obtenha no Supabase Dashboard > Project Settings > API > service_role key]
```

✅ Marque: **"Deploy to production"**

---

## ✅ VARIÁVEL 3: RESEND_API_KEY

**Nome da variável:**
```
RESEND_API_KEY
```

**Valor:**
```
[Obtenha no Resend Dashboard > API Keys]
```

✅ Marque: **"Deploy to production"**

---

## ✅ VARIÁVEL 4: SUPABASE_ANON_KEY (Opcional mas recomendado)

**Nome da variável:**
```
SUPABASE_ANON_KEY
```

**Valor:**
```
[Obtenha no Supabase Dashboard > Project Settings > API > anon/public key]
```

✅ Marque: **"Deploy to production"**

---

## 🎯 APÓS ADICIONAR TODAS AS VARIÁVEIS

1. ✅ Salve todas as alterações
2. ⏱️ Aguarde 2-3 minutos para o próximo deploy automático
3. 🧪 Teste a recuperação de senha novamente
4. 📊 Se ainda der erro, verifique os logs em: **Functions > request-password-reset**

---

## ⚠️ IMPORTANTE

- Todas as variáveis devem estar marcadas como **"Deploy to production"**
- Não adicione espaços extras ao copiar os valores
- As variáveis são sensíveis - não compartilhe publicamente

