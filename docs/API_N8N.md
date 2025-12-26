# Documentação da API N8N - Google My Business Integration

Esta documentação descreve os webhooks do N8N utilizados para a integração com o Google My Business.

## Autenticação

### `GET /api/auth/google/start`
Inicia o fluxo de autenticação OAuth 2.0 com o Google.
*   **Query Params**:
    *   `slug`: O slug do site/loja que está solicitando a conexão.
*   **Resposta**: Redireciona para a página de consentimento do Google.

### `GET /api/auth/google/callback`
Recebe o código de autorização do Google e troca por tokens de acesso.
*   **Query Params**:
    *   `code`: Código de autorização.
    *   `state`: Estado para validação CSRF (contém o slug).
*   **Ação**: Salva as credenciais no banco de dados e redireciona o usuário de volta para a aplicação.

## Reviews

### `GET /api/google/reviews`
Busca reviews de uma localização específica.
*   **Query Params**:
    *   `slug`: Slug da loja.
    *   `locationId`: ID da localização no Google (opcional, usa a principal se não informado).
*   **Resposta**: JSON com lista de reviews.

### `POST /api/google/reviews/respond`
Envia uma resposta para um review.
*   **Body**:
    *   `slug`: Slug da loja.
    *   `reviewId`: ID do review no Google.
    *   `reply`: Texto da resposta.
*   **Resposta**: JSON com status de sucesso.

## Estatísticas

### `GET /api/google/reviews/stats`
Retorna estatísticas agregadas dos reviews.
*   **Query Params**:
    *   `slug`: Slug da loja.
    *   `period`: Período de análise (ex: '30d').
*   **Resposta**: JSON com métricas (total, média, distribuição).
