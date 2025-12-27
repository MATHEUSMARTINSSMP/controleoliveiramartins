# ✅ Verificação de Endpoints da API Google My Business

Baseado na documentação oficial: https://developers.google.com/my-business/content/basic-setup

## 📋 Endpoints Verificados

### ✅ **Reviews** - IMPLEMENTADO CORRETAMENTE
**Endpoint oficial:**
```
GET /v4/{parent=accounts/*/locations/*}/reviews
```

**Nossa implementação:**
- Arquivo: `netlify/functions/google-reviews-fetch.js`
- Endpoint usado: `https://mybusiness.googleapis.com/v4/${locationId}/reviews`
- ✅ CORRETO (locationId já inclui o caminho completo `accounts/.../locations/...`)

---

### ✅ **Media** - IMPLEMENTADO, MAS PRECISA CORREÇÃO
**Endpoint oficial:**
```
GET /v4/{parent=accounts/*/locations/*}/media
```

**Nossa implementação:**
- Arquivo: `netlify/functions/google-media-fetch.js`
- Endpoint usado: `https://mybusiness.googleapis.com/v4/${locationId}/media`
- ✅ CORRETO (locationId já inclui o caminho completo)

---

### ✅ **Posts (LocalPosts)** - IMPLEMENTADO, MAS PRECISA CORREÇÃO
**Endpoint oficial:**
```
GET /v4/{parent=accounts/*/locations/*}/localPosts
```

**Nossa implementação:**
- Arquivo: `netlify/functions/google-posts-fetch.js`
- Endpoint usado: `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`
- ✅ CORRETO (locationId já inclui o caminho completo)

---

### ❌ **Questions** - NÃO IMPLEMENTADO
**Endpoint oficial:**
```
GET /v4/{parent=accounts/*/locations/*}/questions
```

**Status:** Não implementado

**Endpoint completo:**
```
GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/questions
```

**Resposta esperada:**
```json
{
  "questions": [
    {
      "name": "accounts/{accountId}/locations/{locationId}/questions/{questionId}",
      "text": "Pergunta do cliente",
      "createTime": "2024-01-01T00:00:00Z",
      "upvoteCount": 5,
      "author": {
        "displayName": "Nome do Cliente"
      },
      "topAnswer": {
        "text": "Resposta",
        "author": {
          "displayName": "Nome do Proprietário",
          "type": "OWNER"
        },
        "createTime": "2024-01-01T00:00:00Z"
      }
    }
  ]
}
```

---

### ❌ **Insights/Performance** - NÃO IMPLEMENTADO
**Endpoint oficial (DEPRECADO):**
```
POST /v4/{name=accounts/*}/locations:reportInsights
```

**⚠️ IMPORTANTE:** 
A documentação menciona que há uma **NOVA API Google Business Profile Performance** com método "DailyMetrics" que substitui `reportInsights`.

**Endpoint novo (presumido - precisa verificar documentação específica):**
```
GET /performance/v1/{locationName}/dailyMetrics
```

**Métricas disponíveis:**
- Visualizações (views)
- Cliques no site (clicks)
- Chamadas (calls)
- Rotas solicitadas (directions)
- Mensagens (messages)
- Etc.

**Ação necessária:**
1. Verificar documentação da nova API de Performance
2. Implementar usando a nova API (não usar reportInsights que está deprecated)
3. Endpoint base: `https://businessprofileperformance.googleapis.com` (presumido)

---

### ❌ **Media Insights** - NÃO IMPLEMENTADO
**Endpoint oficial:**
```
GET /v4/{name=accounts/*/locations/*}/media/{mediaItemId}
```

Retorna metadados incluindo insights (viewCount, etc).

**Status:** Já buscamos mídias, mas não estamos buscando insights individuais de cada mídia.

---

### ❌ **Posts Insights** - NÃO IMPLEMENTADO
**Endpoint oficial:**
```
POST /v4/{name=accounts/*/locations/*}/localPosts:reportInsights
```

Retorna insights para postagens (visualizações, cliques, etc).

---

## 🔍 Endpoints Adicionais Úteis

### **List Locations**
```
GET /v4/{parent=accounts/*}/locations
```
✅ Já usamos no callback OAuth para buscar locations

### **Get Location**
```
GET /v4/{name=accounts/*/locations/*}
```
✅ Usamos para buscar detalhes completos da location

---

## 📝 Resumo de Correções Necessárias

### 1. **Questions** - Criar implementação completa
- [ ] Criar `netlify/functions/google-questions-fetch.js`
- [ ] Criar hook `use-google-questions.ts`
- [ ] Atualizar `QuestionsManager.tsx`

### 2. **Performance/Insights** - Implementar nova API
- [ ] Pesquisar documentação da nova API Google Business Profile Performance
- [ ] Criar `netlify/functions/google-performance-fetch.js`
- [ ] Atualizar `GoogleStats.tsx` para usar dados reais
- [ ] Atualizar `AdvancedInsights.tsx` para usar dados reais
- [ ] Atualizar `StatsInsights.tsx` para receber dados reais

### 3. **Posts Insights** - Adicionar busca de métricas
- [ ] Implementar chamada para `reportInsights` de posts
- [ ] Atualizar `PostsAnalytics.tsx` para usar dados reais

### 4. **Reviews Analytics** - Calcular baseado em dados reais
- [ ] Calcular métricas baseadas em reviews do banco
- [ ] Atualizar `ReviewsAnalytics.tsx`

---

## ⚠️ Notas Importantes

1. **API v4 vs v1**: A maioria dos endpoints usa v4, mas upload de media usa v1
2. **reportInsights está DEPRECADO**: Precisamos usar a nova API de Performance
3. **Location ID format**: `accounts/{accountId}/locations/{locationId}` (caminho completo)
4. **Rate Limits**: Google impõe limites de taxa, implementar retry logic (já temos)

---

## 🔗 Referências

- Documentação oficial: https://developers.google.com/my-business/content/basic-setup
- Discovery Document: https://mybusiness.googleapis.com/$discovery/rest?version=v4
- Nova API Performance: (precisa buscar documentação específica)

