# 📋 Instruções para Atualizar n8n - Buscar Reviews Reais

## 🎯 Objetivo

Atualizar o workflow do n8n para buscar reviews reais de cada location do Google My Business, incluindo `account_id` e `location_id` nos reviews salvos.

---

## 🔧 Modificações Necessárias no n8n

### 1. Atualizar Webhook `/api/google/reviews`

O webhook atual busca accounts, mas não busca locations nem reviews. Precisamos atualizar para:

```
Webhook - Reviews Fetch
  ↓
Code - Normalize Input
  ↓
PostgreSQL - Get Credentials
  ↓
Code - Token Check
  ↓
IF - Need Refresh?
  ├─ [True] → Refresh Token Flow
  └─ [False] → Continue
  ↓
Code - Get Accounts and Locations (NOVO)
  ↓
Loop Over Locations (NOVO)
  ↓
  ├─ HTTP Request - List Reviews (NOVO)
  ├─ Code - Process Reviews Response (NOVO)
  └─ PostgreSQL - Save Reviews with Account/Location (NOVO)
  ↓
Code - Format Response (ATUALIZAR)
  ↓
Respond - Success
```

### 2. Node: Code - Get Accounts and Locations

**Posição:** Após "Code - Token Check" (quando não precisa refresh)

**Código:**
```javascript
// Code - Get Accounts and Locations
// Busca accounts e locations do banco de dados ou da API do Google
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: false,
      error: 'Nenhum dado recebido'
    }
  }];
}

const tokenData = inputData[0].json || {};
const access_token = tokenData.access_token || '';
const customer_id = tokenData.customer_id || '';
const site_slug = tokenData.site_slug || '';

if (!access_token) {
  return [{
    json: {
      success: false,
      error: 'access_token não encontrado'
    }
  }];
}

// Primeiro, tentar buscar do banco de dados
// Se não encontrar, buscar da API do Google e salvar

return [{
  json: {
    access_token: access_token,
    customer_id: customer_id,
    site_slug: site_slug,
    token_type: tokenData.token_type || 'Bearer',
    // Flag para indicar que precisa buscar da API
    fetch_from_api: true
  }
}];
```

### 3. Node: HTTP Request - List Accounts (se não tiver no banco)

**Tipo:** HTTP Request
**Método:** GET
**URL:** `https://mybusinessbusinessinformation.googleapis.com/v1/accounts`
**Headers:**
- `Authorization`: `={{$json.token_type}} {{$json.access_token}}`

**Response:**
- Full Response: Yes
- Response Format: JSON

### 4. Node: Code - Process Accounts and Get Locations

**Código:**
```javascript
// Code - Process Accounts and Get Locations
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: false,
      error: 'Nenhuma resposta recebida'
    }
  }];
}

const httpResponse = inputData[0].json || {};
const statusCode = inputData[0].statusCode || httpResponse.statusCode || 0;

// Verificar erros
if (statusCode >= 400 || httpResponse.error) {
  return [{
    json: {
      success: false,
      error: httpResponse.error?.message || httpResponse.body?.error?.message || `HTTP ${statusCode}`,
      statusCode: statusCode
    }
  }];
}

// Extrair accounts
const accounts = httpResponse.body?.accounts || [];

if (accounts.length === 0) {
  return [{
    json: {
      success: true,
      locations: [],
      message: 'Nenhuma account encontrada'
    }
  }];
}

// Buscar dados preservados
const tokenData = $('Code - Get Accounts and Locations').all();
const preservedData = tokenData && tokenData.length > 0 
  ? tokenData[0].json 
  : {};

// Para cada account, buscar locations
const locations = [];

for (const account of accounts) {
  const account_id = account.name || ''; // Formato: "accounts/123456789"
  
  // Buscar locations desta account
  // Isso será feito no próximo node (HTTP Request - List Locations)
  locations.push({
    account_id: account_id,
    account_name: account.accountName || '',
    account_type: account.type || 'PERSONAL',
    access_token: preservedData.access_token || '',
    customer_id: preservedData.customer_id || '',
    site_slug: preservedData.site_slug || '',
    token_type: preservedData.token_type || 'Bearer',
    locations_url: `https://mybusinessbusinessinformation.googleapis.com/v1/${account_id}/locations`
  });
}

// Retornar para processar cada account
return locations.map(loc => ({
  json: loc
}));
```

### 5. Node: HTTP Request - List Locations

**Tipo:** HTTP Request
**Método:** GET
**URL:** `={{$json.locations_url}}`
**Headers:**
- `Authorization`: `={{$json.token_type}} {{$json.access_token}}`

**Response:**
- Full Response: Yes
- Response Format: JSON

### 6. Node: Code - Process Locations Response

**Código:**
```javascript
// Code - Process Locations Response
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: false,
      error: 'Nenhuma resposta recebida'
    }
  }];
}

const httpResponse = inputData[0].json || {};
const statusCode = inputData[0].statusCode || httpResponse.statusCode || 0;

// Verificar erros
if (statusCode >= 400 || httpResponse.error) {
  console.log('Erro ao buscar locations:', httpResponse.error);
  // Continuar mesmo com erro (pode não ter locations)
  return [{
    json: {
      success: true,
      locations: [],
      account_id: $json.account_id || '',
      customer_id: $json.customer_id || '',
      site_slug: $json.site_slug || ''
    }
  }];
}

// Extrair locations
const locations = httpResponse.body?.locations || [];

if (locations.length === 0) {
  return [{
    json: {
      success: true,
      locations: [],
      account_id: $json.account_id || '',
      customer_id: $json.customer_id || '',
      site_slug: $json.site_slug || ''
    }
  }];
}

// Processar cada location
return locations.map(location => ({
  json: {
    success: true,
    account_id: $json.account_id || '',
    account_name: $json.account_name || '',
    location_id: location.name || '', // Formato: "locations/987654321"
    location_name: location.title || location.storefront?.title || '',
    access_token: $json.access_token || '',
    customer_id: $json.customer_id || '',
    site_slug: $json.site_slug || '',
    token_type: $json.token_type || 'Bearer',
    // URL para buscar reviews desta location
    reviews_url: `https://mybusiness.googleapis.com/v4/${location.name}/reviews`
  }
}));
```

### 7. Node: PostgreSQL - Save Account/Location (se não existir)

**Tipo:** PostgreSQL
**Operation:** Execute Query

**Query:**
```sql
INSERT INTO elevea.google_business_accounts (
  customer_id,
  site_slug,
  account_id,
  account_name,
  account_type,
  location_id,
  location_name,
  is_primary
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8
)
ON CONFLICT (customer_id, site_slug, account_id, location_id) 
DO UPDATE SET
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  location_name = EXCLUDED.location_name,
  updated_at = NOW()
RETURNING id, account_id, location_id;
```

**Query Replacement:**
```
$1 → {{$json.customer_id}}
$2 → {{$json.site_slug}}
$3 → {{$json.account_id}}
$4 → {{$json.account_name}}
$5 → {{$json.account_type}}
$6 → {{$json.location_id}}
$7 → {{$json.location_name}}
$8 → false
```

### 8. Node: HTTP Request - List Reviews

**Tipo:** HTTP Request
**Método:** GET
**URL:** `={{$json.reviews_url}}`
**Headers:**
- `Authorization`: `={{$json.token_type}} {{$json.access_token}}`

**Query Parameters:**
- `pageSize`: `50` (máximo permitido pelo Google)
- `orderBy`: `updateTime desc` (mais recentes primeiro)

**Response:**
- Full Response: Yes
- Response Format: JSON

### 9. Node: Code - Process Reviews Response

**Código:**
```javascript
// Code - Process Reviews Response
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: false,
      error: 'Nenhuma resposta recebida'
    }
  }];
}

const httpResponse = inputData[0].json || {};
const statusCode = inputData[0].statusCode || httpResponse.statusCode || 0;

// Verificar erros
if (statusCode >= 400 || httpResponse.error) {
  console.log('Erro ao buscar reviews:', httpResponse.error);
  // Continuar mesmo com erro (pode não ter reviews)
  return [{
    json: {
      success: true,
      reviews: [],
      account_id: $json.account_id || '',
      location_id: $json.location_id || '',
      customer_id: $json.customer_id || '',
      site_slug: $json.site_slug || ''
    }
  }];
}

// Extrair reviews
const reviews = httpResponse.body?.reviews || [];

if (reviews.length === 0) {
  return [{
    json: {
      success: true,
      reviews: [],
      account_id: $json.account_id || '',
      location_id: $json.location_id || '',
      customer_id: $json.customer_id || '',
      site_slug: $json.site_slug || ''
    }
  }];
}

// Processar cada review
return reviews.map(review => ({
  json: {
    success: true,
    customer_id: $json.customer_id || '',
    site_slug: $json.site_slug || '',
    account_id: $json.account_id || '',
    location_id: $json.location_id || '',
    review_id_external: review.reviewId || review.name || '', // ID do review
    rating: review.starRating || review.rating || 0,
    comment: review.comment || '',
    author_name: review.reviewer?.displayName || review.reviewer?.profilePhotoUrl || 'Anônimo',
    review_date: review.createTime || review.updateTime || new Date().toISOString(),
    reply: review.reply?.comment || '',
    // Metadados adicionais
    review_url: review.reviewId ? `https://www.google.com/maps/reviews/${review.reviewId}` : null,
    is_local_guide: review.reviewer?.isAnonymous === false && review.reviewer?.profilePhotoUrl ? true : false
  }
}));
```

### 10. Node: PostgreSQL - Save Reviews with Account/Location

**Tipo:** PostgreSQL
**Operation:** Execute Query

**Query:**
```sql
INSERT INTO elevea.google_reviews (
  customer_id,
  site_slug,
  review_id_external,
  rating,
  comment,
  author_name,
  review_date,
  reply,
  account_id,
  location_id,
  synced_at
)
VALUES (
  $1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), 
  COALESCE(TO_TIMESTAMP($7::text, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), NOW()),
  COALESCE(NULLIF($8, ''), ''),
  $9,
  $10,
  NOW()
)
ON CONFLICT (customer_id, site_slug, review_id_external)
DO UPDATE SET
  rating = EXCLUDED.rating,
  comment = EXCLUDED.comment,
  author_name = EXCLUDED.author_name,
  review_date = EXCLUDED.review_date,
  reply = COALESCE(NULLIF(EXCLUDED.reply, ''), google_reviews.reply),
  account_id = EXCLUDED.account_id,
  location_id = EXCLUDED.location_id,
  synced_at = EXCLUDED.synced_at,
  updated_at = NOW()
RETURNING review_id, customer_id, site_slug, review_id_external, account_id, location_id;
```

**Query Replacement:**
```
$1 → {{$json.customer_id}}
$2 → {{$json.site_slug}}
$3 → {{$json.review_id_external}}
$4 → {{$json.rating}}
$5 → {{$json.comment}}
$6 → {{$json.author_name}}
$7 → {{$json.review_date}}
$8 → {{$json.reply}}
$9 → {{$json.account_id}}
$10 → {{$json.location_id}}
```

### 11. Node: Code - Format Response (ATUALIZAR)

**Código:**
```javascript
// Code - Format Response
// Agrega todos os reviews coletados
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: true,
      ok: true,
      reviews: [],
      totalReviews: 0,
      message: 'Nenhum review encontrado'
    }
  }];
}

// Filtrar apenas reviews válidos (com review_id_external)
const validReviews = inputData
  .filter(item => item.json && item.json.review_id_external)
  .map(item => ({
    review_id_external: item.json.review_id_external,
    rating: item.json.rating || 0,
    comment: item.json.comment || '',
    author_name: item.json.author_name || 'Anônimo',
    review_date: item.json.review_date || new Date().toISOString(),
    reply: item.json.reply || '',
    account_id: item.json.account_id || '',
    location_id: item.json.location_id || ''
  }));

// Calcular estatísticas
const totalReviews = validReviews.length;
const averageRating = totalReviews > 0
  ? validReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
  : 0;

// Agrupar por location
const locations = {};
validReviews.forEach(review => {
  const locId = review.location_id || 'unknown';
  if (!locations[locId]) {
    locations[locId] = {
      location_id: locId,
      reviews: []
    };
  }
  locations[locId].reviews.push(review);
});

return [{
  json: {
    success: true,
    ok: true,
    reviews: validReviews,
    totalReviews: totalReviews,
    averageRating: Number(averageRating.toFixed(2)),
    locations: Object.values(locations),
    account: {
      name: validReviews[0]?.account_id || ''
    }
  }
}];
```

---

## 🔄 Fluxo Completo Atualizado

### Fluxo de OAuth (já existe, apenas adicionar após salvar credenciais):

```
Execute a SQL query (Salvar Credenciais)
  ↓
Code - Fetch Accounts (NOVO - ver INSTRUCOES_N8N_GOOGLE_ACCOUNTS.md)
  ↓
HTTP Request - List Accounts
  ↓
Code - Process Accounts Response
  ↓
Loop Over Accounts
  ↓
  ├─ HTTP Request - List Locations
  ├─ Code - Process Locations Response
  └─ PostgreSQL - Save Account/Location
  ↓
Code - Format Callback Response
```

### Fluxo de Buscar Reviews (ATUALIZAR):

```
Webhook - Reviews Fetch
  ↓
Code - Normalize Input
  ↓
PostgreSQL - Get Credentials
  ↓
Code - Token Check
  ↓
IF - Need Refresh?
  ├─ [True] → Refresh Token Flow
  └─ [False] → Continue
  ↓
Code - Get Accounts and Locations (NOVO)
  ↓
IF - Has Locations in DB?
  ├─ [True] → Use from DB
  └─ [False] → Fetch from API
  ↓
Loop Over Locations
  ↓
  ├─ HTTP Request - List Reviews
  ├─ Code - Process Reviews Response
  └─ PostgreSQL - Save Reviews with Account/Location
  ↓
Code - Format Response
  ↓
Respond - Success
```

---

## 📝 Notas Importantes

1. **Paginação de Reviews:** A API do Google retorna até 50 reviews por página. Se houver mais, implementar paginação usando `nextPageToken`.

2. **Rate Limits:** Adicionar delays entre requisições se necessário (especialmente ao buscar múltiplas locations).

3. **Erros:** Tratar erros graciosamente. Se uma location não tiver reviews, continuar com as outras.

4. **Performance:** Se houver muitas locations, considerar processar em batches.

5. **Sincronização:** Usar `ON CONFLICT` para atualizar reviews existentes em vez de criar duplicatas.

---

## ✅ Checklist de Implementação

- [ ] Adicionar node "Code - Get Accounts and Locations"
- [ ] Adicionar lógica para buscar locations do banco primeiro
- [ ] Se não encontrar no banco, buscar da API do Google
- [ ] Adicionar loop para processar cada location
- [ ] Adicionar node "HTTP Request - List Reviews" para cada location
- [ ] Adicionar node "Code - Process Reviews Response"
- [ ] Atualizar node "PostgreSQL - Save Reviews" para incluir account_id e location_id
- [ ] Atualizar node "Code - Format Response" para agregar reviews de todas as locations
- [ ] Testar com conta que tem múltiplas locations
- [ ] Testar com conta que tem apenas uma location
- [ ] Testar com location sem reviews
- [ ] Tratar erros de rate limit
- [ ] Implementar paginação de reviews (se necessário)
- [ ] Adicionar logs para debugging

---

## 🔍 Exemplo de Resposta da API do Google

### List Reviews Response:
```json
{
  "reviews": [
    {
      "reviewId": "ChZDSUhNMG9nS0VJQ0FnSUR4aGMyLTl3EAE",
      "reviewer": {
        "displayName": "João Silva",
        "profilePhotoUrl": "https://..."
      },
      "starRating": "FIVE",
      "comment": "Excelente atendimento!",
      "createTime": "2024-01-15T10:30:00Z",
      "updateTime": "2024-01-15T10:30:00Z",
      "reply": {
        "comment": "Obrigado pelo feedback!",
        "updateTime": "2024-01-16T08:00:00Z"
      }
    }
  ],
  "nextPageToken": "..." // Se houver mais reviews
}
```

### Mapeamento de Star Rating:
- `"ONE"` → 1
- `"TWO"` → 2
- `"THREE"` → 3
- `"FOUR"` → 4
- `"FIVE"` → 5

