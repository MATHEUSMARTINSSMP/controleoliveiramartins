# 🔄 Migração: n8n → Netlify Functions

## 🎯 Decisão

**Migrar toda a lógica do Google My Business para Netlify Functions** ao invés de usar n8n.

### ✅ Vantagens

1. **Tudo no mesmo repositório** - Código versionado junto com o frontend
2. **Mais controle** - Lógica completa em JavaScript/Node.js
3. **Mais fácil de debugar** - Logs no Netlify, código local
4. **Sem dependência externa** - Não precisa manter n8n rodando
5. **Deploy automático** - Já está integrado com o deploy do frontend
6. **Custo** - Netlify Functions tem generoso free tier
7. **Performance** - Serverless, escala automaticamente

### ⚠️ Desvantagens

1. **Mais código para manter** - Mas é mais simples e direto
2. **Sem interface visual** - Mas código é mais fácil de entender

---

## 📁 Estrutura Criada

### Functions Criadas

1. **`netlify/functions/google-oauth-start.js`**
   - **Endpoint:** `GET /.netlify/functions/google-oauth-start`
   - **Função:** Inicia o fluxo OAuth do Google com PKCE
   - **Substitui:** n8n webhook `/api/auth/google/start`

2. **`netlify/functions/google-oauth-callback.js`**
   - **Endpoint:** `GET /.netlify/functions/google-oauth-callback`
   - **Função:** Processa callback OAuth, salva tokens e accounts/locations
   - **Substitui:** n8n webhook `/api/auth/google/callback`

3. **`netlify/functions/google-reviews-fetch.js`**
   - **Endpoint:** `POST /.netlify/functions/google-reviews-fetch`
   - **Função:** Busca reviews reais de todas as locations
   - **Substitui:** n8n webhook `/api/google/reviews`

4. **`netlify/functions/google-reviews-respond.js`**
   - **Endpoint:** `POST /.netlify/functions/google-reviews-respond`
   - **Função:** Responde a uma review do Google
   - **Substitui:** n8n webhook `/api/google/reviews/respond`

5. **`netlify/functions/google-reviews-stats.js`**
   - **Endpoint:** `GET /.netlify/functions/google-reviews-stats`
   - **Função:** Retorna estatísticas agregadas dos reviews
   - **Substitui:** n8n webhook `/api/google/reviews/stats`

---

## 🔧 Configuração Necessária

### 1. Variáveis de Ambiente no Netlify

**⚠️ CRÍTICO:** Configure estas variáveis ANTES de testar!

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
- **Após adicionar as variáveis, faça um novo deploy!**

**Como adicionar:**
1. Acesse: https://app.netlify.com/sites/[SEU_SITE]/configuration/env
2. Clique em "Add a variable"
3. Adicione cada variável acima
4. Clique em "Save"
5. **Faça um novo deploy** (Deploys → Trigger deploy → Deploy site)

### 2. Atualizar Google Cloud Console

**⚠️ CRÍTICO:** Atualize o Google Cloud Console ANTES de testar!

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

**⏳ Aguarde 5 minutos a algumas horas** para as configurações entrarem em vigor (conforme aviso do Google).

### 3. Atualizar Frontend (Opcional)

O frontend já está preparado para usar Netlify Functions automaticamente através das variáveis de ambiente:

```typescript
const USE_NETLIFY_FUNCTIONS = import.meta.env.VITE_USE_NETLIFY_FUNCTIONS !== "false"; // Default true
```

Para forçar uso de Netlify Functions, adicionar no `.env`:
```
VITE_USE_NETLIFY_FUNCTIONS=true
VITE_NETLIFY_FUNCTIONS_BASE=/.netlify/functions
```

---

## 🔄 Fluxo Completo

### 1. Iniciar OAuth

**Frontend:**
```typescript
// Hook já atualizado para usar Netlify Functions
const authUrl = await startAuth(siteSlug);
// Redireciona para: https://accounts.google.com/o/oauth2/v2/auth?...
```

**Netlify Function:**
- `google-oauth-start.js` gera PKCE e URL de autorização
- Retorna `authUrl` para o frontend

### 2. Callback OAuth

**Google redireciona para:**
```
   https://eleveaone.com.br/.netlify/functions/google-oauth-callback?code=...&state=...
```

**Netlify Function:**
- `google-oauth-callback.js` processa callback
- Troca código por tokens
- Salva credenciais no banco
- Busca e salva accounts/locations (em background)
- Redireciona para dashboard

### 3. Buscar Reviews

**Frontend:**
```typescript
// Hook já atualizado
const reviews = await fetchReviews(siteSlug);
```

**Netlify Function:**
- `google-reviews-fetch.js` busca reviews de todas as locations
- Salva no banco com account_id e location_id
- Retorna lista de reviews

### 4. Responder Review

**Frontend:**
```typescript
// Hook já atualizado
await respondToReview(siteSlug, reviewId, reply);
```

**Netlify Function:**
- `google-reviews-respond.js` envia resposta para Google
- Atualiza review no banco

### 5. Estatísticas

**Frontend:**
```typescript
// Hook já atualizado
const stats = await fetchStats(siteSlug, period);
```

**Netlify Function:**
- `google-reviews-stats.js` calcula estatísticas do banco
- Retorna métricas agregadas

---

## ✅ Checklist de Migração

### Backend (Netlify Functions)
- [x] ✅ `google-oauth-start.js` criada
- [x] ✅ `google-oauth-callback.js` criada
- [x] ✅ `google-reviews-fetch.js` criada
- [x] ✅ `google-reviews-respond.js` criada
- [x] ✅ `google-reviews-stats.js` criada
- [ ] **FALTA:** Testar todas as functions localmente
- [ ] **FALTA:** Deploy no Netlify
- [ ] **FALTA:** Configurar variáveis de ambiente
- [ ] **FALTA:** Atualizar Google Cloud Console com novo redirect URI

### Frontend
- [x] ✅ Hooks atualizados para usar Netlify Functions
- [x] ✅ Fallback para n8n se necessário
- [ ] **FALTA:** Testar fluxo completo
- [ ] **FALTA:** Verificar se variáveis de ambiente estão corretas

### Banco de Dados
- [x] ✅ Todas as tabelas criadas
- [x] ✅ RLS policies configuradas
- [ ] **FALTA:** Testar salvamento de accounts/locations
- [ ] **FALTA:** Testar salvamento de reviews com account_id/location_id

---

## 🧪 Testes

### Testar Localmente

1. **Instalar Netlify CLI:**
```bash
npm install -g netlify-cli
```

2. **Rodar localmente:**
```bash
netlify dev
```

3. **Testar endpoints:**
- `http://localhost:8888/.netlify/functions/google-oauth-start?customerId=test@example.com&siteSlug=test`

### Testar em Produção

1. Fazer deploy no Netlify
2. Testar fluxo completo:
   - Conectar Google
   - Verificar se accounts/locations foram salvos
   - Buscar reviews
   - Responder review
   - Ver estatísticas

---

## 📝 Notas Importantes

1. **PKCE:** O code_verifier está sendo incluído no state (base64url). Em produção, considere usar Redis para armazenar temporariamente.

2. **Rate Limits:** Functions têm delays entre requisições para evitar rate limit do Google.

3. **Background Jobs:** Busca de accounts/locations no callback é feita em background (não bloqueia redirect).

4. **Erros:** Todas as functions têm tratamento de erros robusto e retornam mensagens amigáveis.

5. **CORS:** Todas as functions têm headers CORS configurados.

---

## 🔗 Referências

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Google My Business API](https://developers.google.com/my-business/content/overview)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)

---

## 🚀 Próximos Passos

1. **Testar functions localmente**
2. **Fazer deploy no Netlify**
3. **Configurar variáveis de ambiente**
4. **Atualizar Google Cloud Console**
5. **Testar fluxo completo**
6. **Desativar workflows do n8n** (opcional, manter como backup)

