# 🔍 Comparação: Payloads WhatsApp Authentication

## ❌ Payload que NÃO Funcionou

```json
{
  "headers": {
    "user-agent": "node",
    "content-type": "application/json",
    "x-app-key": "#mmP220411"
  },
  "body": {
    "customer_id": "matheusmartinss@icloud.com",
    "site_slug": "loungerie",
    "uazapi_admin_token": "Ae2iqkYNCGGesMvNt8w9eCCNffK4cDvQfZ342FRAcTkrp2VZ7z"
  },
  "webhookUrl": "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect"
}
```

## ✅ Payload que FUNCIONOU (dos screenshots)

```json
{
  "headers": {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "content-type": "application/json",
    "x-app-key": "#mmP220411",
    "origin": "https://eleveaagencia.netlify.app"
  },
  "body": {
    "customerId": "mathmartins@gmail.com",
    "siteSlug": "elevea",
    "uazapiToken": ""
  },
  "webhookUrl": "https://fluxos.eleveaagencia.com.br/webhook/api/whatsapp/auth/connect"
}
```

## 📊 Principais Diferenças Identificadas

### 1. ⚠️ **Nomes dos Campos no Body** (CRÍTICO!)

| Campo | ❌ NÃO Funcionou (snake_case) | ✅ Funcionou (camelCase) |
|-------|------------------------------|-------------------------|
| Email do cliente | `customer_id` | `customerId` |
| Nome da loja | `site_slug` | `siteSlug` |
| Token admin | `uazapi_admin_token` | `uazapiToken` |

**PROBLEMA IDENTIFICADO**: O workflow n8n está esperando campos em **camelCase**, mas nosso frontend está enviando em **snake_case**!

### 2. **User-Agent**

- ❌ Não funcionou: `"node"` (requisição server-side do Netlify Function)
- ✅ Funcionou: `"Mozilla/5.0..."` (requisição browser-side direta)

### 3. **Dados de Entrada**

- ❌ Não funcionou:
  - `customer_id`: `matheusmartinss@icloud.com`
  - `site_slug`: `loungerie`
  - `uazapi_admin_token`: Presente com valor completo
  
- ✅ Funcionou:
  - `customerId`: `mathmartins@gmail.com`
  - `siteSlug`: `elevea`
  - `uazapiToken`: Vazio inicialmente (é preenchido depois pelo workflow)

### 4. **Headers Adicionais**

- ✅ Funcionou tem: `origin`, `referer` (por ser requisição do browser)

---

## 🔧 Problema Principal

**O workflow n8n está esperando campos em camelCase (`customerId`, `siteSlug`, `uazapiToken`), mas nosso código está enviando em snake_case (`customer_id`, `site_slug`, `uazapi_admin_token`)!**

### Onde está o problema:

1. **Netlify Function `whatsapp-auth.js`** envia:
   ```javascript
   {
     customer_id: customer_id,      // ❌ snake_case
     site_slug: site_slug,          // ❌ snake_case
     uazapi_admin_token: uazapiAdminToken  // ❌ snake_case
   }
   ```

2. **Workflow n8n espera** (conforme screenshots do node "Code - Normalize Auth"):
   ```javascript
   {
     customerId: ...,     // ✅ camelCase
     siteSlug: ...,       // ✅ camelCase
     uazapiToken: ...     // ✅ camelCase (inicialmente vazio, preenchido depois)
   }
   ```

### Evidência nos Screenshots:

No screenshot do node "Code - Normalize Auth" do workflow que funcionou:
- Input body: `customerId`, `siteSlug`, `uazapiToken`
- O código extrai: `json.body.customerId`, `json.body.siteSlug`, `json.body.uazapiToken`

---

## ✅ Solução

**Opção 1** (RECOMENDADA): Ajustar o payload enviado pelo Netlify Function para usar camelCase
- Vantagem: Mantém compatibilidade com workflow já funcionando
- Desvantagem: Muda formato do payload

**Opção 2**: Ajustar o workflow n8n para aceitar snake_case
- Vantagem: Mantém padrão atual do código
- Desvantagem: Requer mudança no workflow n8n

**Recomendação**: Ajustar o Netlify Function para enviar camelCase, pois:
1. O workflow já está funcionando com camelCase
2. É uma mudança simples e localizada
3. Mantém consistência com o que já funciona

---

## 📝 Outros Problemas Identificados

### Schema do Banco de Dados

O workflow está usando:
- `elevea.uazapi_config` 
- `elevea.whatsapp_credentials`

**Deveria usar:**
- `sistemaretiradas.uazapi_config`
- `sistemaretiradas.whatsapp_credentials`

Mas isso é um problema do workflow n8n, não do payload.
