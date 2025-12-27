# ✅ Resolução: Formato de Location ID nas APIs Google My Business

## 📋 Situação Atual

Temos uma **inconsistência** entre as APIs:

1. **Business Information API v1** (usada para buscar locations em `google-locations-refresh.js`)
   - Retorna: `location.name = "locations/987654321"` (apenas o ID)

2. **API v4** (usada para reviews, media, posts, questions)
   - Espera: `locationId = "accounts/123456789/locations/987654321"` (formato completo)

3. **Banco de dados** (`google_business_accounts.location_id`)
   - Atualmente salva: `"987654321"` (apenas o ID numérico)
   - `account_id` salva: `"accounts/123456789"` (formato completo)

## ✅ Solução: Converter ao Usar na API v4

Ao usar o `location_id` nas APIs v4, precisamos **reconstruir o formato completo**:

```javascript
// No banco temos:
// account_id = "accounts/123456789"
// location_id = "987654321"

// Para usar na API v4, construir:
const locationIdForV4 = `${accountId}/locations/${locationId}`;
// Resultado: "accounts/123456789/locations/987654321"
```

## 🔧 Onde Aplicar

### 1. google-reviews-fetch.js
```javascript
// Buscar account_id e location_id do banco
const { data: locations } = await supabase
  .from('google_business_accounts')
  .select('account_id, location_id')
  .eq('customer_id', userEmail)
  .eq('site_slug', siteSlug);

// Para cada location, construir o formato completo
for (const location of locations) {
  const locationIdForV4 = `${location.account_id}/locations/${location.location_id}`;
  
  // Usar na API v4
  const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/reviews`;
}
```

### 2. google-media-fetch.js
```javascript
// Mesma lógica: construir formato completo
const locationIdForV4 = `${accountId}/locations/${locationId}`;
const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/media`;
```

### 3. google-posts-fetch.js
```javascript
// Mesma lógica
const locationIdForV4 = `${accountId}/locations/${locationId}`;
const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/localPosts`;
```

### 4. google-questions-fetch.js
```javascript
// Mesma lógica
const locationIdForV4 = `${accountId}/locations/${locationId}`;
const url = `https://mybusiness.googleapis.com/v4/${locationIdForV4}/questions`;
```

## ⚠️ Problema Atual

No código atual, algumas funções esperam receber `locationId` já no formato completo, mas estamos salvando apenas o ID numérico no banco.

**Precisamos garantir que**:
1. Quando buscamos do banco, sempre temos `account_id` e `location_id` juntos
2. Ao usar nas APIs v4, sempre construímos o formato completo

## 📝 Estrutura Ideal no Banco

**Manter como está** (separado):
- `account_id`: `"accounts/123456789"` (formato completo)
- `location_id`: `"987654321"` (apenas ID numérico)

**Vantagens**:
- ✅ Normalizado (não duplicamos o account_id)
- ✅ Flexível (podemos usar location_id sozinho se necessário)
- ✅ Fácil de converter quando necessário

## ✅ Checklist de Correção

- [ ] Verificar se `google-reviews-fetch.js` constrói formato completo corretamente
- [ ] Verificar se `google-media-fetch.js` constrói formato completo corretamente
- [ ] Verificar se `google-posts-fetch.js` constrói formato completo corretamente
- [ ] Verificar se `google-questions-fetch.js` constrói formato completo corretamente
- [ ] Verificar se `google-oauth-callback.js` salva account_id e location_id corretamente
- [ ] Verificar se `google-locations-refresh.js` salva account_id e location_id corretamente

## 🎯 Conclusão

**Não precisamos mudar o formato no banco**. Precisamos apenas **garantir que todas as funções que usam locationId nas APIs v4 construam o formato completo** a partir de `account_id` e `location_id`.

