# 🐛 Problema Identificado: Formato de Location ID

## ⚠️ BUG: Inconsistência no Formato de locationId

### O Problema

1. **Salvamos no banco** (google-oauth-callback.js linha 101):
   ```javascript
   const locationId = locationName.replace('locations/', ''); // Salva: "987654321"
   ```

2. **Usamos na API v4** (google-reviews-fetch.js linha 393):
   ```javascript
   const url = `https://mybusiness.googleapis.com/v4/${location.location_id}/reviews`;
   // location.location_id = "987654321" ❌
   // API espera: "accounts/123456789/locations/987654321" ✅
   ```

3. **Resultado**: A API v4 retorna erro porque o formato está incorreto!

---

## ✅ Solução

Precisamos **construir o formato completo** ao usar nas APIs v4:

```javascript
// No banco temos:
// account_id = "accounts/123456789"
// location_id = "987654321"

// Construir formato completo para API v4:
const locationIdForV4 = `${location.account_id}/locations/${location.location_id}`;
// Resultado: "accounts/123456789/locations/987654321"

// Usar na API v4:
const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/reviews`;
```

---

## 📝 Funções que Precisam de Correção

### 1. google-reviews-fetch.js
- Linha 393: `fetchLocationReviews(accessToken, location.location_id, pageToken)`
- **Correção**: Construir formato completo antes de usar

### 2. google-media-fetch.js
- Linha 24: `https://mybusiness.googleapis.com/v4/${locationId}/media`
- **Correção**: Garantir que locationId está no formato completo

### 3. google-posts-fetch.js
- Similar ao google-media-fetch.js
- **Correção**: Garantir formato completo

### 4. google-questions-fetch.js
- Similar ao google-media-fetch.js
- **Correção**: Garantir formato completo

### 5. google-reviews-respond.js
- Linha 168: `https://mybusiness.googleapis.com/v4/${locationId}/reviews/${reviewId}:reply`
- **Correção**: Garantir formato completo

---

## 🎯 Formato Esperado por Cada API

### API v4 (reviews, media, posts, questions)
```
accounts/123456789/locations/987654321
```

### Business Information API v1 (buscar locations)
```
locations/987654321
```

### Account Management API v1 (buscar accounts)
```
accounts/123456789
```

---

## ✅ Estratégia

1. **Salvar no banco** (manter como está):
   - `account_id`: `"accounts/123456789"` (formato completo)
   - `location_id`: `"987654321"` (apenas ID numérico)

2. **Ao usar nas APIs v4** (CORRIGIR):
   ```javascript
   const locationIdForV4 = `${account_id}/locations/${location_id}`;
   ```

3. **Função helper recomendada**:
   ```javascript
   function buildLocationIdForV4(accountId, locationId) {
     // Se locationId já está no formato completo, retornar direto
     if (locationId.includes('/locations/')) {
       return locationId;
     }
     // Se não, construir o formato completo
     return `${accountId}/locations/${locationId}`;
   }
   ```

