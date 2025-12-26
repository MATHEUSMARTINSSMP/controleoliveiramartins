# 📋 Instruções para Atualizar n8n - Buscar e Salvar Accounts/Locations

## 🎯 Objetivo

Após a autenticação OAuth bem-sucedida, precisamos:
1. Buscar todas as **accounts** do Google My Business
2. Para cada account, buscar todas as **locations**
3. Salvar essas informações no banco de dados (`elevea.google_business_accounts`)

## 🔧 Modificações Necessárias no n8n

### 1. Após o Node "Execute a SQL query" (Salvar Credenciais)

Adicionar novos nodes para buscar e salvar accounts/locations:

```
Execute a SQL query (Salvar Credenciais)
  ↓
Code - Fetch Accounts (NOVO)
  ↓
HTTP Request - List Accounts
  ↓
Code - Process Accounts Response (NOVO)
  ↓
Loop Over Accounts (NOVO)
  ↓
  ├─ HTTP Request - List Locations (NOVO)
  ├─ Code - Process Locations Response (NOVO)
  └─ PostgreSQL - Save Account/Location (NOVO)
  ↓
Code - Format Callback Response (EXISTENTE)
```

### 2. Node: Code - Fetch Accounts

**Posição:** Após "Execute a SQL query"

**Código:**
```javascript
// Code - Fetch Accounts
// Prepara requisição para buscar accounts do Google My Business
const inputData = $input.all();

if (inputData.length === 0) {
  return [{
    json: {
      success: false,
      error: 'Nenhum dado recebido'
    }
  }];
}

const sqlResult = inputData[0].json || {};
const access_token = sqlResult.access_token || '';

if (!access_token) {
  return [{
    json: {
      success: false,
      error: 'access_token não encontrado'
    }
  }];
}

// Preservar dados do SQL
return [{
  json: {
    access_token: access_token,
    customer_id: sqlResult.customer_id || '',
    site_slug: sqlResult.site_slug || '',
    token_type: sqlResult.token_type || 'Bearer',
    // URL da API do Google My Business
    accounts_url: 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts'
  }
}];
```

### 3. Node: HTTP Request - List Accounts

**Tipo:** HTTP Request
**Método:** GET
**URL:** `={{$json.accounts_url}}`
**Headers:**
- `Authorization`: `={{$json.token_type}} {{$json.access_token}}`

**Response:**
- Full Response: Yes
- Response Format: JSON

### 4. Node: Code - Process Accounts Response

**Código:**
```javascript
// Code - Process Accounts Response
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
      accounts: [],
      message: 'Nenhuma account encontrada'
    }
  }];
}

// Buscar dados preservados
const fetchAccountsData = $('Code - Fetch Accounts').all();
const preservedData = fetchAccountsData && fetchAccountsData.length > 0 
  ? fetchAccountsData[0].json 
  : {};

// Retornar accounts com dados preservados
return accounts.map(account => ({
  json: {
    success: true,
    account: account,
    account_id: account.name || '', // Formato: "accounts/123456789"
    account_name: account.accountName || '',
    account_type: account.type || 'PERSONAL',
    access_token: preservedData.access_token || '',
    customer_id: preservedData.customer_id || '',
    site_slug: preservedData.site_slug || '',
    token_type: preservedData.token_type || 'Bearer'
  }
}));
```

### 5. Node: Loop Over Accounts

**Tipo:** Split In Batches (ou usar Function node com loop)

**Ou usar:** Code node com loop manual:

```javascript
// Code - Loop Over Accounts
const items = $input.all();
const output = [];

for (const item of items) {
  const account = item.json;
  
  // Adicionar item para buscar locations desta account
  output.push({
    json: {
      ...account,
      locations_url: `https://mybusinessbusinessinformation.googleapis.com/v1/${account.account_id}/locations`
    }
  });
}

return output;
```

### 6. Node: HTTP Request - List Locations

**Tipo:** HTTP Request
**Método:** GET
**URL:** `={{$json.locations_url}}`
**Headers:**
- `Authorization`: `={{$json.token_type}} {{$json.access_token}}`

**Response:**
- Full Response: Yes
- Response Format: JSON

### 7. Node: Code - Process Locations Response

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
    account_type: $json.account_type || '',
    location_id: location.name || '', // Formato: "locations/987654321"
    location_name: location.title || location.storefront?.title || '',
    location_address: location.storefront?.address?.addressLines?.join(', ') || '',
    location_phone: location.storefront?.primaryPhone || location.storefront?.phoneNumbers?.[0] || '',
    location_website: location.storefront?.websiteUri || '',
    location_category: location.categories?.primaryCategory?.displayName || '',
    location_latitude: location.storefront?.address?.latlng?.latitude || null,
    location_longitude: location.storefront?.address?.latlng?.longitude || null,
    customer_id: $json.customer_id || '',
    site_slug: $json.site_slug || '',
    is_primary: false // Primeira location será definida como primária depois
  }
}));
```

### 8. Node: PostgreSQL - Save Account/Location

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
  location_address,
  location_phone,
  location_website,
  location_category,
  location_latitude,
  location_longitude,
  is_primary
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (customer_id, site_slug, account_id, location_id) 
DO UPDATE SET
  account_name = EXCLUDED.account_name,
  account_type = EXCLUDED.account_type,
  location_name = EXCLUDED.location_name,
  location_address = EXCLUDED.location_address,
  location_phone = EXCLUDED.location_phone,
  location_website = EXCLUDED.location_website,
  location_category = EXCLUDED.location_category,
  location_latitude = EXCLUDED.location_latitude,
  location_longitude = EXCLUDED.location_longitude,
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
$8 → {{$json.location_address}}
$9 → {{$json.location_phone}}
$10 → {{$json.location_website}}
$11 → {{$json.location_category}}
$12 → {{$json.location_latitude}}
$13 → {{$json.location_longitude}}
$14 → {{$json.is_primary}}
```

### 9. Node: Code - Set Primary Location (Opcional)

Após salvar todas as locations, definir a primeira como primária:

**Código:**
```javascript
// Code - Set Primary Location
// Define a primeira location como primária
const inputData = $input.all();

if (inputData.length === 0) {
  return [{ json: { success: true } }];
}

// Pegar primeira location salva
const firstLocation = inputData[0].json || {};

return [{
  json: {
    success: true,
    customer_id: firstLocation.customer_id,
    site_slug: firstLocation.site_slug,
    account_id: firstLocation.account_id,
    location_id: firstLocation.location_id,
    set_primary: true
  }
}];
```

**Depois adicionar:** PostgreSQL node para atualizar `is_primary = true` para a primeira location.

## 📝 Notas Importantes

1. **Rate Limits:** A API do Google tem limites. Adicione delays entre requisições se necessário.

2. **Erros:** Trate erros graciosamente. Se uma account não tiver locations, continue com as outras.

3. **Performance:** Se houver muitas accounts/locations, considere processar em batches.

4. **Primeira Location:** Defina a primeira location como `is_primary = true` automaticamente.

5. **Atualização:** Use `ON CONFLICT` para atualizar locations existentes em vez de criar duplicatas.

## ✅ Checklist de Implementação

- [ ] Adicionar node "Code - Fetch Accounts" após salvar credenciais
- [ ] Adicionar node "HTTP Request - List Accounts"
- [ ] Adicionar node "Code - Process Accounts Response"
- [ ] Adicionar loop para processar cada account
- [ ] Adicionar node "HTTP Request - List Locations" para cada account
- [ ] Adicionar node "Code - Process Locations Response"
- [ ] Adicionar node "PostgreSQL - Save Account/Location"
- [ ] Adicionar lógica para definir location primária
- [ ] Testar com conta Google que tem múltiplas accounts/locations
- [ ] Testar com conta que tem apenas uma location
- [ ] Tratar erros de rate limit
- [ ] Adicionar logs para debugging

---

## 🔗 Próximos Passos

Após implementar a busca e salvamento de accounts/locations, consulte:
- `docs/INSTRUCOES_N8N_GOOGLE_REVIEWS.md` - Instruções para buscar reviews reais de cada location

