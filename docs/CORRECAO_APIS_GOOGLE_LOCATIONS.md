# 🔄 Correção: APIs Google My Business para Locations

## Situação Atual

Após análise da documentação oficial, descobrimos que existem **MÚLTIPLAS APIs** para trabalhar com Google My Business:

### 1. API Google My Business v4 (Deprecated parcialmente)
- **Serviço**: `mybusiness.googleapis.com/v4`
- **Status**: Alguns endpoints ainda funcionam, mas não é a API recomendada para locations
- **Endpoints que ainda usamos**:
  - ✅ Reviews: `/v4/{locationId}/reviews`
  - ✅ Media: `/v4/{locationId}/media`
  - ✅ Posts: `/v4/{locationId}/localPosts`
  - ✅ Questions: `/v4/{locationId}/questions`
  - ⚠️ Performance: `/v4/{accountName}/locations:reportInsights` (DEPRECATED)

### 2. API My Business Business Information v1 (RECOMENDADA para Locations)
- **Serviço**: `mybusinessbusinessinformation.googleapis.com/v1`
- **Status**: ✅ API oficial e recomendada para gerenciar locations
- **Endpoints**:
  - `GET /v1/accounts/{accountId}/locations` - Listar locations
  - `GET /v1/locations/{locationId}` - Buscar location específica
  - `POST /v1/accounts/{accountId}/locations` - Criar location
  - `PATCH /v1/locations/{locationId}` - Atualizar location
  - `DELETE /v1/locations/{locationId}` - Excluir location

### 3. API My Business Account Management v1 (Para Accounts)
- **Serviço**: `mybusinessaccountmanagement.googleapis.com/v1`
- **Status**: ✅ API oficial para gerenciar accounts
- **Endpoints**:
  - `GET /v1/accounts` - Listar accounts
  - `GET /v1/accounts/{accountId}` - Buscar account específica

## ⚠️ Problema Identificado

Atualmente, nosso código está **misturando as APIs**:

1. **google-oauth-callback.js**: 
   - ❌ Estava usando `mybusinessbusinessinformation.googleapis.com/v1/accounts` (ERRADO para listar accounts)
   - ✅ Corrigido para `mybusinessaccountmanagement.googleapis.com/v1/accounts`
   - ⚠️ Mas ainda usa `mybusiness.googleapis.com/v4/{accountName}/locations` para buscar locations

2. **google-locations-refresh.js**:
   - ✅ Usa `mybusiness.googleapis.com/v4/accounts` (ERRADO - deveria ser Account Management API)
   - ⚠️ Usa `mybusiness.googleapis.com/v4/{accountName}/locations` (PODE estar incorreto)

## ✅ Correção Necessária

### Para Accounts (listar)
**Correto**: `mybusinessaccountmanagement.googleapis.com/v1/accounts`

### Para Locations (listar, criar, atualizar)
**Correto**: `mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations`

**NOTA**: O `accountId` na Business Information API é diferente do `accountName` da v4:
- **v4**: `accountName` = `accounts/123456789` (formato completo)
- **Business Information v1**: `accountId` = `123456789` (apenas o ID numérico)

## ⚠️ Consideração Importante

Embora a Business Information API seja a **recomendada** para locations, a API v4 ainda funciona para:
- Reviews, Media, Posts, Questions

Portanto, temos duas opções:

### Opção 1: Usar Business Information API para Locations (RECOMENDADO)
- ✅ API oficial e suportada
- ✅ Mais estável e mantida
- ⚠️ Requer converter `accountName` (v4) para `accountId` (numérico)

### Opção 2: Manter v4 (FUNCIONA, mas não é recomendado)
- ✅ Já está funcionando
- ✅ Compatível com outras chamadas (reviews, media, etc)
- ⚠️ Não é a API recomendada pela Google
- ⚠️ Pode ser descontinuada no futuro

## 📝 Estrutura de IDs

### API Account Management v1:
```javascript
// Listar accounts
GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts

// Resposta:
{
  "accounts": [{
    "name": "accounts/123456789",  // accountName completo
    "accountName": "Minha Empresa",
    "type": "PERSONAL"
  }]
}
```

### API Business Information v1:
```javascript
// Listar locations (precisa do accountId numérico)
GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/123456789/locations

// Resposta:
{
  "locations": [{
    "name": "locations/987654321",  // locationName completo
    "locationName": "Minha Loja",
    "title": "Minha Loja"
  }]
}
```

### API v4:
```javascript
// Listar locations (usa accountName completo)
GET https://mybusiness.googleapis.com/v4/accounts/123456789/locations

// Resposta:
{
  "locations": [{
    "name": "accounts/123456789/locations/987654321",  // locationName completo
    "title": "Minha Loja"
  }]
}
```

## 🎯 Recomendação

**MANTENDO A API v4 POR ENQUANTO** porque:
1. ✅ Já está funcionando
2. ✅ É compatível com outras chamadas que já usamos (reviews, media, posts, questions)
3. ⚠️ Não é a API oficial recomendada, mas ainda funciona

**MAS** documentar claramente que:
- Accounts devem ser buscadas via Account Management API
- Locations podem ser buscadas via v4 (funciona) ou Business Information API (recomendado)
- Migrar para Business Information API no futuro quando tivermos tempo para refatoração completa

## 📋 Checklist de Verificação

- [x] Accounts: Usar Account Management API v1
- [ ] Locations: Decidir entre manter v4 ou migrar para Business Information API v1
- [x] Reviews: v4 (OK, funciona)
- [x] Media: v4 (OK, funciona)
- [x] Posts: v4 (OK, funciona)
- [x] Questions: v4 (OK, funciona)
- [⚠️] Performance: reportInsights (deprecated, mas funciona)

