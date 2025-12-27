# ✅ Deploy de Funções Google My Business

## Status

As seguintes funções foram criadas e commitadas, mas **precisam ser deployadas no Netlify**:

1. ✅ `google-performance-fetch.js` - Buscar métricas de performance (views, clicks, calls, directions)
2. ✅ `google-questions-fetch.js` - Buscar perguntas e respostas
3. ✅ `google-locations-refresh.js` - Atualizar locations da API do Google

## Verificação

As funções foram commitadas nos seguintes commits:
- `f3467d5` - `feat: implementar busca de dados reais para todos componentes Google` (26/12/2025)
- `ebed1b7` - `feat: implementar refresh de locations do Google My Business via API` (26/12/2025)

## Endpoints

Após o deploy, os seguintes endpoints estarão disponíveis:

- `POST /.netlify/functions/google-performance-fetch`
- `POST /.netlify/functions/google-questions-fetch`
- `POST /.netlify/functions/google-locations-refresh`

## Parâmetros Esperados

### google-performance-fetch
```json
{
  "siteSlug": "string",
  "userEmail": "string",
  "locationId": "string (opcional)",
  "period": "7d|30d|90d|1y (opcional, padrão: 30d)"
}
```

### google-questions-fetch
```json
{
  "siteSlug": "string",
  "userEmail": "string",
  "locationId": "string (opcional)"
}
```

### google-locations-refresh
```json
{
  "siteSlug": "string",
  "userEmail": "string"
}
```

## Ação Necessária

O Netlify deve fazer deploy automático se estiver configurado para monitorar o branch `main`. 

Se o erro 404 persistir após alguns minutos:
1. Verifique se o deploy foi concluído no painel do Netlify
2. Se necessário, force um novo deploy manualmente no painel do Netlify
3. Aguarde alguns minutos após o deploy para as funções ficarem disponíveis

## Nota Importante

As funções usam a API v4 do Google My Business (`mybusiness.googleapis.com/v4`). O endpoint `reportInsights` usado em `google-performance-fetch` pode estar deprecated em favor da nova Performance API, mas ainda funciona.

