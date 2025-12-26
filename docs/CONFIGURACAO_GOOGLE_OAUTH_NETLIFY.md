# 🔧 Configuração Google OAuth - Netlify Functions

## 📋 Checklist Completo

### ✅ 1. Variáveis de Ambiente no Netlify

**Acesse:** Netlify Dashboard → Seu Site → Site settings → Environment variables

**Adicione as seguintes variáveis:**

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=<SEU_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<SEU_CLIENT_SECRET>

# Redirect URI (domínio principal)
GOOGLE_REDIRECT_URI=https://eleveaone.com.br/.netlify/functions/google-oauth-callback

# Frontend URL (para redirecionamento após OAuth)
FRONTEND_URL=https://eleveaone.com.br
```

**⚠️ IMPORTANTE:**
- Use `eleveaone.com.br` como domínio principal
- O `GOOGLE_REDIRECT_URI` deve ser EXATAMENTE igual ao configurado no Google Cloud Console
- As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já devem estar configuradas

**Como adicionar:**
1. Acesse: https://app.netlify.com/sites/[SEU_SITE]/configuration/env
2. Clique em "Add a variable"
3. Adicione cada variável acima
4. Clique em "Save"

---

### ✅ 2. Atualizar Google Cloud Console

**Acesse:** https://console.cloud.google.com/apis/credentials?project=cosmic-sensor-473804-k9

**Project ID:** `cosmic-sensor-473804-k9`

#### 2.1. Atualizar Authorized Redirect URIs

1. Clique no seu **OAuth 2.0 Client ID**
2. Em **"Authorized redirect URIs"**, adicione:
   ```
   https://eleveaone.com.br/.netlify/functions/google-oauth-callback
   ```
3. **Mantenha o antigo do n8n** (caso precise fazer rollback):
   ```
   https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback
   ```
4. Clique em **"Save"**

#### 2.2. Atualizar Authorized JavaScript Origins

1. No mesmo OAuth Client, em **"Authorized JavaScript origins"**, certifique-se de ter:
   ```
   https://eleveaone.com.br
   https://fluxos.eleveaagencia.com.br
   ```
2. Clique em **"Save"**

#### 2.3. Verificar OAuth Consent Screen

**Acesse:** https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9

Verifique se está configurado:
- ✅ **App name:** ELEVEA
- ✅ **User support email:** mathmartins@gmail.com
- ✅ **App homepage:** `https://eleveaone.com.br`
- ✅ **Privacy Policy link:** `https://eleveaone.com.br/politicas`
- ✅ **Terms of Service link:** `https://eleveaone.com.br/termos`
- ✅ **Authorized domains:** `eleveaone.com.br`

---

### ✅ 3. Verificar Functions Criadas

As seguintes Netlify Functions foram criadas:

1. ✅ `netlify/functions/google-oauth-start.js`
   - Endpoint: `GET /.netlify/functions/google-oauth-start`
   
2. ✅ `netlify/functions/google-oauth-callback.js`
   - Endpoint: `GET /.netlify/functions/google-oauth-callback`
   
3. ✅ `netlify/functions/google-reviews-fetch.js`
   - Endpoint: `POST /.netlify/functions/google-reviews-fetch`
   
4. ✅ `netlify/functions/google-reviews-respond.js`
   - Endpoint: `POST /.netlify/functions/google-reviews-respond`
   
5. ✅ `netlify/functions/google-reviews-stats.js`
   - Endpoint: `GET /.netlify/functions/google-reviews-stats`

**Verificar se estão no repositório:**
```bash
ls -la netlify/functions/google-*.js
```

---

### ✅ 4. Testar Configuração

#### 4.1. Testar Variáveis de Ambiente

Após fazer deploy, as functions devem usar as variáveis de ambiente automaticamente.

**Verificar logs do Netlify:**
1. Acesse: Netlify Dashboard → Seu Site → Functions
2. Clique em uma function
3. Veja os logs para verificar se as variáveis estão sendo lidas

#### 4.2. Testar OAuth Start

**URL de teste:**
```
GET https://eleveaone.com.br/.netlify/functions/google-oauth-start?customerId=test@example.com&siteSlug=test
```

**Resposta esperada:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "timestamp": "2024-...",
  "customerId": "test@example.com",
  "siteSlug": "test"
}
```

#### 4.3. Testar Fluxo Completo

1. **Iniciar OAuth:**
   - Acesse a página de integração Google no frontend
   - Clique em "Conectar Google"
   - Deve redirecionar para Google OAuth

2. **Autorizar:**
   - Faça login no Google
   - Autorize o app
   - Deve redirecionar para: `https://eleveaone.com.br/.netlify/functions/google-oauth-callback?code=...&state=...`

3. **Callback:**
   - O callback deve processar e redirecionar para: `https://eleveaone.com.br/client/dashboard?gmb=ok&site=...`

4. **Verificar Banco:**
   - Verifique se as credenciais foram salvas em `elevea.google_credentials`
   - Verifique se accounts/locations foram salvos em `elevea.google_business_accounts`

---

## 🔄 Migração do n8n para Netlify Functions

### O que mudou:

| Antes (n8n) | Depois (Netlify Functions) |
|------------|---------------------------|
| `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/start` | `https://eleveaone.com.br/.netlify/functions/google-oauth-start` |
| `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback` | `https://eleveaone.com.br/.netlify/functions/google-oauth-callback` |
| `https://fluxos.eleveaagencia.com.br/webhook/api/google/reviews` | `https://eleveaone.com.br/.netlify/functions/google-reviews-fetch` |

### Frontend já atualizado:

Os hooks `use-google-auth.ts` e `use-google-reviews.ts` já foram atualizados para usar Netlify Functions automaticamente, com fallback para n8n se necessário.

---

## 🐛 Troubleshooting

### Erro: "redirect_uri_mismatch"

**Causa:** O redirect URI no Google Cloud Console não corresponde ao configurado na function.

**Solução:**
1. Verifique `GOOGLE_REDIRECT_URI` no Netlify
2. Verifique se está EXATAMENTE igual no Google Cloud Console
3. URLs devem ser idênticas (incluindo `https://`, sem barra no final)

### Erro: "invalid_client"

**Causa:** Client ID ou Client Secret incorretos.

**Solução:**
1. Verifique `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Netlify
2. Verifique se estão corretos no Google Cloud Console
3. Faça um novo deploy após atualizar as variáveis

### Erro: "Configuração do servidor incompleta"

**Causa:** Variáveis de ambiente não configuradas.

**Solução:**
1. Verifique se todas as variáveis estão configuradas no Netlify
2. Faça um novo deploy após adicionar variáveis
3. Verifique os logs da function para ver qual variável está faltando

### Function não encontrada (404)

**Causa:** Function não foi deployada ou caminho incorreto.

**Solução:**
1. Verifique se os arquivos estão em `netlify/functions/`
2. Faça commit e push
3. Verifique se o deploy foi concluído no Netlify

---

## 📝 Notas Importantes

1. **PKCE:** O code_verifier está sendo incluído no state (base64url). Em produção, considere usar Redis para armazenar temporariamente.

2. **Rate Limits:** Functions têm delays entre requisições para evitar rate limit do Google.

3. **Background Jobs:** Busca de accounts/locations no callback é feita em background (não bloqueia redirect).

4. **Erros:** Todas as functions têm tratamento de erros robusto e retornam mensagens amigáveis.

5. **CORS:** Todas as functions têm headers CORS configurados.

6. **Segurança:** Client ID e Secret estão em variáveis de ambiente, não hardcoded (exceto fallback para desenvolvimento).

---

## ✅ Checklist Final

- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Google Cloud Console atualizado com novo redirect URI
- [ ] Functions deployadas no Netlify
- [ ] Teste de OAuth start funcionando
- [ ] Teste de callback funcionando
- [ ] Credenciais sendo salvas no banco
- [ ] Accounts/locations sendo salvos no banco
- [ ] Reviews sendo buscados corretamente
- [ ] Respostas a reviews funcionando

---

## 🔗 Links Úteis

- **Google Cloud Console:** https://console.cloud.google.com/apis/credentials?project=cosmic-sensor-473804-k9
- **OAuth Consent Screen:** https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
- **Netlify Functions:** https://app.netlify.com/sites/[SEU_SITE]/functions
- **Netlify Environment Variables:** https://app.netlify.com/sites/[SEU_SITE]/configuration/env

