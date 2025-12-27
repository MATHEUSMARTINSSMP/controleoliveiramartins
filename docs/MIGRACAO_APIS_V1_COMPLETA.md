# ✅ Migração Completa para APIs Google Business Profile v1

## Resumo

Migração de todas as funções para usar as APIs novas (v1) do Google Business Profile, seguindo as recomendações oficiais.

---

## ✅ Mudanças Implementadas

### 1. Helper Functions Criado
**Arquivo**: `netlify/functions/utils/googleBusinessProfileHelpers.js`

Funções para converter entre formatos de resource names:
- `extractAccountId()` - Extrai ID numérico de accountName
- `extractLocationId()` - Extrai ID numérico de locationName  
- `buildV4Parent()` - Constrói formato v4 a partir de account_name e location_name v1
- `normalizeAccountName()` - Normaliza para formato "accounts/123"
- `normalizeLocationName()` - Normaliza para formato "locations/987"

---

### 2. google-oauth-callback.js ✅

**Mudanças**:
- ✅ Migrado `fetchLocations()` para usar **Business Information API v1** com `readMask` obrigatório
- ✅ `saveAccountLocation()` agora salva `location.name` como vem (`locations/987654321`), não extrai ID
- ✅ Salva `account_name` e `location_name` separadamente conforme formato v1

**Endpoint usado**:
```
GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations?readMask=...
```

---

### 3. google-locations-refresh.js ✅

**Mudanças**:
- ✅ Já estava usando Business Information API v1
- ✅ Corrigido `saveAccountLocation()` para salvar `location.name` como vem
- ✅ Salva `account_name` e `location_name` separadamente

---

### 4. google-reviews-fetch.js ✅

**Mudanças**:
- ✅ Adicionado `buildV4Parent` para construir formato v4 ao usar API v4
- ✅ Adicionado `readMask` obrigatório na chamada Business Information API v1
- ✅ Corrigido salvamento para usar `location.name` como vem
- ✅ Construção de `locationIdForV4` antes de chamar `fetchLocationReviews()`

**Fluxo**:
1. Busca locations com Business Information API v1 (formato: `locations/987`)
2. Salva no banco: `account_id = "accounts/123"`, `location_id = "locations/987"`
3. Ao buscar reviews (API v4), constrói: `accounts/123/locations/987`

---

### 5. google-media-fetch.js ✅

**Mudanças**:
- ✅ Adicionado `buildV4Parent` import
- ✅ Busca `account_id` e `location_id` do banco
- ✅ Constrói formato v4 antes de chamar API v4

---

### 6. google-posts-fetch.js ✅

**Mudanças**:
- ✅ Adicionado `buildV4Parent` import
- ⚠️ Ainda precisa corrigir lógica de busca de locations (similar ao google-media-fetch.js)

---

### 7. google-questions-fetch.js ✅

**Mudanças**:
- ✅ Adicionado `buildV4Parent` import
- ⚠️ Ainda precisa corrigir lógica de busca de locations (similar ao google-media-fetch.js)

---

### 8. google-reviews-respond.js ⚠️

**Pendências**:
- ⚠️ Precisa usar `buildV4Parent` para construir formato v4
- ⚠️ Precisa buscar `account_id` do banco se não fornecido

---

## 📋 Estrutura de Dados no Banco

### Tabela: `google_business_accounts`

**Campos principais**:
- `account_id`: `"accounts/123456789"` (formato completo v1)
- `location_id`: `"locations/987654321"` (formato completo v1)

**Vantagens**:
- ✅ Alinhado com formato v1 (Business Information API)
- ✅ Compatível com v4 (construímos formato v4 na hora)
- ✅ Não depende de formato legado
- ✅ Robusto para futuras mudanças

---

## 🔄 Fluxo de Conversão

### Quando usar API v4 (reviews, media, posts, questions):

```javascript
// 1. Buscar do banco
const { data: location } = await supabase
  .from('google_business_accounts')
  .select('account_id, location_id')
  .eq('customer_id', userEmail)
  .eq('site_slug', siteSlug)
  .single();

// 2. Construir formato v4
const locationIdForV4 = buildV4Parent(
  location.account_id,    // "accounts/123456789"
  location.location_id    // "locations/987654321"
);
// Resultado: "accounts/123456789/locations/987654321"

// 3. Usar na API v4
const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/reviews`;
```

---

## ✅ APIs Usadas

### Accounts
- **API**: Account Management API v1
- **Endpoint**: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`

### Locations (listar/buscar/atualizar)
- **API**: Business Information API v1  
- **Endpoint**: `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations?readMask=...`
- **readMask obrigatório**: `name,title,storefrontAddress,phoneNumbers,websiteUri,primaryCategory,openInfo,latlng`

### Reviews, Media, Posts, Questions
- **API**: My Business API v4 (ainda necessário, não há versão v1)
- **Formato esperado**: `accounts/{accountId}/locations/{locationId}/...`
- **Construção**: Usar `buildV4Parent(accountName, locationName)`

---

## 🎯 Status Final

- [x] Helper functions criadas
- [x] google-oauth-callback.js migrado
- [x] google-locations-refresh.js corrigido
- [x] google-reviews-fetch.js corrigido
- [x] google-media-fetch.js corrigido
- [⚠️] google-posts-fetch.js (parcial - falta lógica de busca)
- [⚠️] google-questions-fetch.js (parcial - falta lógica de busca)
- [⚠️] google-reviews-respond.js (pendente)

---

## 📝 Notas Importantes

1. **readMask é obrigatório** na Business Information API v1
2. **Sempre salvar** `location.name` como vem, não extrair ID
3. **Sempre construir formato v4** antes de usar APIs v4
4. **Manter compatibilidade** com dados antigos (usar helpers que normalizam)

