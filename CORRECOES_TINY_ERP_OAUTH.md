# 🔧 Correções Implementadas - Integração Tiny ERP OAuth

## 📋 Problema Identificado

A URL de autorização OAuth estava incorreta, resultando em erro 404:
- **URL Incorreta:** `https://erp.tiny.com.br/oauth/authorize`
- **URL Correta:** `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth`

## ✅ Correções Aplicadas

### 1. **Endpoints OAuth Corrigidos**

#### Tiny ERP
- **Authorization URL:** `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth`
- **Token URL:** `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token`
- **API v3 Base:** `https://erp.tiny.com.br/public-api/v3`

#### Bling
- **Authorization URL:** `https://www.bling.com.br/Api/v3/oauth/authorize`
- **Token URL:** `https://www.bling.com.br/Api/v3/oauth/token`

### 2. **Formato de Requisição**

Tiny ERP usa **OAuth 2.0 padrão (OpenID Connect)**:
- **Content-Type:** `application/x-www-form-urlencoded` (não JSON)
- **Body:** `URLSearchParams` (não JSON.stringify)

### 3. **URL de Callback**

Corrigida para usar a Netlify Function:
- **Antes:** `${origin}/api/erp/callback`
- **Agora:** `${origin}/.netlify/functions/erp-oauth-callback`

### 4. **Escopos OAuth**

Tiny ERP usa escopos padrão OAuth 2.0:
- `openid profile email`
- Escopos customizados são definidos no aplicativo OAuth no Tiny ERP

### 5. **API v3**

Chamadas à API agora usam:
- **Base URL:** `https://erp.tiny.com.br/public-api/v3`
- **Authorization:** `Bearer {access_token}` no header
- **Content-Type:** `application/json`

## 📝 Arquivos Modificados

1. **`src/lib/erpIntegrations.ts`**
   - Endpoints OAuth corrigidos
   - Formato de requisição ajustado (form-urlencoded para Tiny)
   - URL de callback corrigida
   - Suporte para API v3

2. **`netlify/functions/erp-oauth-callback.js`**
   - Endpoints OAuth corrigidos
   - Formato de requisição ajustado
   - URL de callback corrigida
   - Redirecionamentos corrigidos para `/dev/erp-config`

3. **`src/pages/dev/ERPConfig.tsx`**
   - Já estava correto, apenas verificado

## 🧪 Próximos Passos para Teste

1. **Configurar Aplicativo OAuth no Tiny ERP:**
   - Acesse: `Menu > Configurações > Aba Geral > Aplicativos`
   - Crie um novo aplicativo
   - Configure a URL de redirecionamento: `https://eleveaone.com.br/.netlify/functions/erp-oauth-callback`
   - Copie o `Client ID` e `Client Secret`

2. **Configurar no Painel Dev:**
   - Acesse: `/dev/erp-config`
   - Selecione uma loja
   - Cole o `Client ID` e `Client Secret`
   - Clique em "Salvar Credenciais"
   - Clique em "Conectar"

3. **Verificar:**
   - Deve redirecionar para `https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth`
   - Após autorizar, deve voltar para `/dev/erp-config?success=true`
   - Status deve mudar para "Conectado"

## 📚 Documentação de Referência

- **API v3 Swagger:** https://erp.tiny.com.br/public-api/v3/swagger/index.html
- **OAuth 2.0:** https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth
- **Documentação Tiny:** https://tinycc.com/tiny/api-docs-v3

