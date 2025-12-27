# ✅ Verificação Completa dos Endpoints da API Google My Business

## Status Atual vs Documentação Oficial

Baseado na [documentação oficial do Google My Business API](https://developers.google.com/my-business/content/basic-setup), verificamos todos os endpoints utilizados no código.

### ⚠️ IMPORTANTE: reportInsights está DEPRECATED

A documentação indica claramente:
> "A API Google Business Performance tem um **NOVO** método de API que permite buscar várias 'DailyMetrics' em uma única solicitação de API. Confira a programação de descontinuação e instruções para migrar do método de API reportInsights v4 para a API Google Business Profile Performance."

**Status**: Nossa função `google-performance-fetch.js` ainda usa `reportInsights` (v4), que está deprecated.

---

## Verificação de Endpoints

### 1. ✅ Accounts - CORRETO

**Função**: `google-oauth-callback.js`, `google-locations-refresh.js`

**Endpoint usado**:
```javascript
// ❌ ERRADO - Estamos usando API errada
'https://mybusinessbusinessinformation.googleapis.com/v1/accounts'

// ✅ CORRETO (v4) - Deveria ser:
'https://mybusiness.googleapis.com/v4/accounts'
```

**Documentação**: 
- API v4: `GET /v4/accounts` (serviço: `mybusiness.googleapis.com`)
- API v1 (Business Information): `GET /v1/accounts` (serviço: `mybusinessbusinessinformation.googleapis.com`)

**Ação necessária**: Atualizar para usar `mybusiness.googleapis.com/v4/accounts`

---

### 2. ⚠️ Locations - PARCIALMENTE CORRETO

**Função**: `google-oauth-callback.js`, `google-locations-refresh.js`

**Endpoint usado**:
```javascript
// ❌ ERRADO - Estamos usando API Business Information v1
`https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`

// ✅ CORRETO (v4) - Deveria ser:
`https://mybusiness.googleapis.com/v4/${accountName}/locations`
```

**Documentação**:
- API v4: `GET /v4/{parent=accounts/*}/locations` (serviço: `mybusiness.googleapis.com`)
- API v1 (Business Information): Usa estrutura diferente

**Diferenças importantes**:
- v4 usa `accountName` (formato: `accounts/123456789`)
- v1 usa `accountId` (formato: `accounts/123456789` também, mas endpoint diferente)

**Ação necessária**: Atualizar para usar `mybusiness.googleapis.com/v4/accounts/{accountName}/locations`

---

### 3. ✅ Reviews - CORRETO

**Função**: `google-reviews-fetch.js`

**Endpoint usado**:
```javascript
// ✅ CORRETO
`https://mybusiness.googleapis.com/v4/${locationId}/reviews`
```

**Documentação**: 
- `GET /v4/{parent=accounts/*/locations/*}/reviews` ✅

---

### 4. ✅ Media - CORRETO

**Função**: `google-media-fetch.js`

**Endpoint usado**:
```javascript
// ✅ CORRETO
`https://mybusiness.googleapis.com/v4/${locationId}/media`
```

**Documentação**: 
- `GET /v4/{parent=accounts/*/locations/*}/media` ✅

---

### 5. ✅ Posts - CORRETO

**Função**: `google-posts-fetch.js`

**Endpoint usado**:
```javascript
// ✅ CORRETO
`https://mybusiness.googleapis.com/v4/${locationId}/localPosts`
```

**Documentação**: 
- `GET /v4/{parent=accounts/*/locations/*}/localPosts` ✅

---

### 6. ✅ Questions - CORRETO

**Função**: `google-questions-fetch.js`

**Endpoint usado**:
```javascript
// ✅ CORRETO
`https://mybusiness.googleapis.com/v4/${locationId}/questions`
```

**Documentação**: 
- `GET /v4/{parent=accounts/*/locations/*}/questions` ✅

---

### 7. ⚠️ Performance/Insights - DEPRECATED

**Função**: `google-performance-fetch.js`

**Endpoint usado**:
```javascript
// ⚠️ DEPRECATED - Ainda funciona, mas será descontinuado
`https://mybusiness.googleapis.com/v4/${accountName}/locations:reportInsights`
```

**Documentação**: 
- `POST /v4/{name=accounts/*}/locations:reportInsights` ⚠️ **DEPRECATED**

**Nova API recomendada**: Google Business Profile Performance API
- Endpoint: `https://businessprofileperformance.googleapis.com/v1/locations/{location_id}/dailyMetrics:fetch`
- Documentação: https://developers.google.com/my-business/content/performance-api

**Ação necessária**: Migrar para a nova Performance API (não urgente, mas recomendado)

---

## Resumo das Correções Necessárias

### 🔴 CRÍTICO - Precisam ser corrigidos:

1. **google-oauth-callback.js**:
   - ❌ `mybusinessbusinessinformation.googleapis.com/v1/accounts` 
   - ✅ `mybusiness.googleapis.com/v4/accounts`
   - ❌ `mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`
   - ✅ `mybusiness.googleapis.com/v4/${accountName}/locations`

2. **google-locations-refresh.js**:
   - ❌ `mybusiness.googleapis.com/v4/accounts` (mas está correto)
   - ❌ `mybusiness.googleapis.com/v4/${locationId}/media` (estrutura incorreta)
   - ✅ Deveria usar: `mybusiness.googleapis.com/v4/${accountName}/locations`

### 🟡 ATENÇÃO - Deprecated mas ainda funcional:

1. **google-performance-fetch.js**:
   - ⚠️ `reportInsights` está deprecated
   - ✅ Funciona, mas deve ser migrado para Performance API no futuro

---

## Estrutura de Location IDs

### Formato correto (v4):

**Accounts**: `accounts/123456789` (accountName)
**Locations**: `accounts/123456789/locations/987654321` (locationName)

### Uso nos endpoints:

```javascript
// Buscar locations de uma account
GET https://mybusiness.googleapis.com/v4/accounts/123456789/locations

// Buscar reviews de uma location
GET https://mybusiness.googleapis.com/v4/accounts/123456789/locations/987654321/reviews

// Buscar media de uma location
GET https://mybusiness.googleapis.com/v4/accounts/123456789/locations/987654321/media
```

---

## Próximos Passos

1. ✅ **Urgente**: Corrigir endpoints de Accounts e Locations em `google-oauth-callback.js` e `google-locations-refresh.js`
2. ⚠️ **Médio prazo**: Planejar migração de `reportInsights` para Performance API
3. ✅ **Verificado**: Reviews, Media, Posts e Questions estão corretos

