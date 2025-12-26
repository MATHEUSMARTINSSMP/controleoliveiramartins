# Configuração Google OAuth - Guia Completo

## 🔗 Informações do Projeto

- **Project ID**: `cosmic-sensor-473804-k9`
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent?project=cosmic-sensor-473804-k9
- **OAuth Client Config**: https://console.cloud.google.com/auth/clients/876861117959-mhvqlkhrcp22uhucv0vpp5jk9r1uscap.apps.googleusercontent.com?project=cosmic-sensor-473804-k9
- **Branding**: https://console.cloud.google.com/auth/branding?project=cosmic-sensor-473804-k9

## 📋 Checklist de Configuração

### 1. Google Cloud Console - Cliente OAuth

#### ✅ Configurações já feitas:
- **Client ID**: `[SEU_CLIENT_ID]` (configure no Google Cloud Console)
- **Client Secret**: `[SEU_CLIENT_SECRET]` (configure no Google Cloud Console)
- **Logo**: Upload realizado ✅
- **Nome do App**: ELEVEA ✅
- **E-mail de Suporte**: mathmartins@gmail.com ✅

#### 🔧 Configurações necessárias:

**A. Origens JavaScript autorizadas (Authorized JavaScript Origins):**
```
https://eleveaagencia.netlify.app
https://fluxos.eleveaagencia.com.br
https://eleveaone.com.br
```

**B. URIs de redirecionamento autorizados (Authorized Redirect URIs):**
```
https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback
```

**C. Domínios autorizados (Authorized Domains):**
```
eleveaagencia.netlify.app
eleveaagencia.com.br
hstgr.cloud
fluxos.eleveaagencia.com.br
```

**D. Branding - Informações do App:**
- **Nome do app**: ELEVEA ✅
- **E-mail para suporte**: mathmartins@gmail.com ✅
- **Página inicial**: `https://eleveaone.com.br` (domínio principal)
- **Política de Privacidade**: `https://eleveaone.com.br/privacy` ou `https://eleveaone.com.br/politicas`
- **Termos de Serviço**: `https://eleveaone.com.br/terms` ou `https://eleveaone.com.br/termos`

**E. Dados de contato do desenvolvedor:**
- **E-mails**: `MATHEUSMARTINSS@ICLOUD.COM` ✅

### 2. Verificação de Escopos

Os escopos configurados no n8n estão corretos:
```
openid
email
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/business.manage
```

**Nota**: O escopo `https://www.googleapis.com/auth/business.manage` requer verificação do app pelo Google.

### 3. Configuração do n8n

#### ✅ Workflow já configurado:
- **Start URL**: `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/start`
- **Callback URL**: `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback`
- **PKCE**: Implementado corretamente ✅

### 4. Passos para Completar a Configuração

#### Passo 1: Configurar URIs no Google Cloud Console

1. Acesse o OAuth Client no Google Cloud Console:
   - Vá em: APIs & Services > Credentials
   - Selecione seu OAuth 2.0 Client ID
   - Ou acesse diretamente: `https://console.cloud.google.com/apis/credentials?project=cosmic-sensor-473804-k9`
   - **Project ID**: `cosmic-sensor-473804-k9`

2. Em **"Origens JavaScript autorizadas"**, adicione (uma por vez, clicando em "+ Adicionar URI"):
   - `https://eleveaagencia.netlify.app`
   - `https://fluxos.eleveaagencia.com.br`
   - `https://eleveaone.com.br`

3. Em **"URIs de redirecionamento autorizados"**, adicione (clicando em "+ Adicionar URI"):
   - `https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback`
   
   ⚠️ **IMPORTANTE**: A URI deve ser EXATAMENTE igual à configurada no n8n, sem barra no final.

4. Clique em **"Salvar"** no final da página

5. ⏳ **Aguarde 5 minutos a algumas horas** para as configurações entrarem em vigor (conforme aviso do Google)

#### Passo 2: Completar Branding

1. Acesse: https://console.cloud.google.com/auth/branding?project=cosmic-sensor-473804-k9
   - **Project ID**: `cosmic-sensor-473804-k9`

2. Preencha os campos obrigatórios:
   - **Página inicial do aplicativo**: `https://eleveaone.com.br` (domínio principal)
   - **Link da Política de Privacidade**: `https://eleveaone.com.br/privacy` ou `https://eleveaone.com.br/politicas`
     - ✅ Páginas criadas: `/privacy` e `/politicas` (ambas funcionam)
   - **Link dos Termos de Serviço**: `https://eleveaone.com.br/terms` ou `https://eleveaone.com.br/termos`
     - ✅ Páginas criadas: `/terms` e `/termos` (ambas funcionam)

3. Verifique se os domínios autorizados incluem (adicione se faltar):
   - `eleveaagencia.netlify.app` ✅
   - `eleveaagencia.com.br` ✅
   - `hstgr.cloud` ✅
   - `fluxos.eleveaagencia.com.br` (adicione se não estiver)

4. Clique em **"Salvar"** no final da página

#### Passo 3: Verificar Escopos Sensíveis

Se você está usando `https://www.googleapis.com/auth/business.manage`, você precisa:

1. Acessar a **Central de verificação** no Google Cloud Console
2. Preencher o formulário de verificação do app (inclui informações sobre o uso do app, screenshots, etc.)
3. Aguardar aprovação do Google (pode levar alguns dias a semanas)

**Alternativa para Teste**: Se não precisar do escopo `business.manage` imediatamente, remova-o temporariamente do workflow n8n para testar o fluxo básico:

```javascript
scope: 'openid email https://www.googleapis.com/auth/userinfo.email'
```

Depois que o fluxo básico funcionar, você pode adicionar o escopo `business.manage` e submeter para verificação.

#### Passo 4: Testar o Fluxo

1. **Teste o endpoint de start:**
   ```
   GET https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/start?customerId=TEST&siteSlug=test
   ```
   
   Você deve receber uma resposta JSON com:
   ```json
   {
     "success": true,
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
     "customerId": "TEST",
     "siteSlug": "test",
     "state": "...",
     "timestamp": "..."
   }
   ```

2. **Copie o `authUrl` e abra no navegador**

3. **Faça login no Google** (se não estiver logado)

4. **Autorize o app** - você verá a tela de consentimento com:
   - Logo do app (ELEVEA)
   - Permissões solicitadas
   - Botão "Permitir"

5. **Após autorizar**, você será redirecionado para:
   ```
   https://fluxos.eleveaagencia.com.br/webhook/api/auth/google/callback?code=...&state=...
   ```

6. **O n8n processará o callback** e trocará o código por tokens

7. **Verifique os logs do n8n** para confirmar que tudo funcionou

### 5. Troubleshooting

#### Erro: "redirect_uri_mismatch"
- Verifique se a URI de callback está EXATAMENTE igual no Google Console e no código
- Certifique-se de que não há espaços ou caracteres extras
- URLs devem começar com `https://` (não `http://`)

#### Erro: "invalid_client"
- Verifique se o Client ID e Client Secret estão corretos
- Certifique-se de que o Client Secret não expirou

#### Erro: "access_denied"
- Verifique se os escopos estão corretos
- Se usar escopos sensíveis, o app precisa estar verificado

#### Erro: "invalid_grant" no refresh token
- Certifique-se de que `access_type=offline` e `prompt=consent` estão na URL de autorização
- O refresh token só é retornado na primeira autorização

### 6. Configuração de Produção

Para produção, certifique-se de:

1. ✅ Todos os domínios estão autorizados
2. ✅ URIs de callback estão configuradas corretamente
3. ✅ Logo está carregada
4. ✅ Política de Privacidade e Termos de Serviço estão publicados
5. ✅ App está verificado (se usar escopos sensíveis)
6. ✅ Client Secret está seguro (não commitado no código)

### 7. Segurança

⚠️ **IMPORTANTE**:
- Nunca commite o Client Secret no código
- Use variáveis de ambiente no n8n para armazenar credenciais
- Mantenha o Client Secret seguro
- Revise as permissões regularmente
- Não compartilhe o Client Secret publicamente

### 8. Configuração no n8n (Usar Variáveis de Ambiente)

**Recomendação**: Ao invés de hardcodar as credenciais no código, use variáveis de ambiente no n8n:

1. No n8n, vá em **Settings** → **Variables**
2. Adicione as variáveis:
   - `GOOGLE_OAUTH_CLIENT_ID`: `[SEU_CLIENT_ID]` (obtenha no Google Cloud Console)
   - `GOOGLE_OAUTH_CLIENT_SECRET`: `[SEU_CLIENT_SECRET]` (obtenha no Google Cloud Console)

3. No código do n8n, use:
   ```javascript
   client_id: $env.GOOGLE_OAUTH_CLIENT_ID,
   client_secret: $env.GOOGLE_OAUTH_CLIENT_SECRET,
   ```

### 9. Verificação de Domínio

⚠️ **IMPORTANTE**: O Google exige que o domínio da página inicial seja verificado.

**Passos para verificar o domínio:**

1. **Verifique no Google Search Console:**
   - Acesse: https://search.google.com/search-console
   - Adicione a propriedade: `https://eleveaone.com.br`
   - Siga o processo de verificação (arquivo HTML, meta tag, ou Google Analytics)

2. **Adicione o domínio no OAuth Consent Screen:**
   - Em "Domínios autorizados", adicione: `eleveaone.com.br`
   - O domínio deve aparecer como verificado após alguns minutos

📚 **Guia completo**: Veja `docs/VERIFICACAO_DOMINIO_GOOGLE.md` para instruções detalhadas.

### 10. Verificação Final

Após configurar tudo, verifique:

- [ ] Domínio `eleveaone.com.br` verificado no Google Search Console
- [ ] Domínio adicionado em "Domínios autorizados" no OAuth Consent Screen
- [ ] URIs de redirecionamento configuradas corretamente
- [ ] Origens JavaScript autorizadas configuradas
- [ ] Logo carregada
- [ ] Página inicial acessível sem login
- [ ] Link para Política de Privacidade visível no footer da página inicial
- [ ] Política de Privacidade e Termos de Serviço configurados e acessíveis
- [ ] Teste do fluxo completo funcionando
- [ ] Tokens sendo salvos corretamente no banco de dados

