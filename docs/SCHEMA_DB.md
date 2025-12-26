# Documentação do Banco de Dados - Google My Business

O esquema de banco de dados utiliza o schema `sistemaretiradas` (anteriormente `elevea`).

## Tabelas Principais

### `google_credentials`
Armazena os tokens de acesso OAuth e informações da conta conectada.
*   `id`: UUID (PK)
*   `site_slug`: String (Unique) - Identificador da loja.
*   `access_token`: Text - Token de acesso atual.
*   `refresh_token`: Text - Token para renovação.
*   `expiry_date`: BigInt - Timestamp de expiração.
*   `profile_picture_url`: Text - URL da foto do perfil Google.
*   `updated_at`: Timestamp.

### `google_business_accounts`
Armazena as contas de negócio (Business Accounts) vinculadas à credencial.
*   `id`: UUID (PK)
*   `google_account_id`: String - ID da conta no Google.
*   `account_name`: String - Nome da conta.
*   `site_slug`: String (FK).

### `google_reviews`
Armazena os reviews sincronizados.
*   `id`: UUID (PK)
*   `review_id_external`: String (Unique) - ID do review no Google.
*   `author_name`: String.
*   `rating`: Integer (1-5).
*   `comment`: Text.
*   `reply`: Text - Resposta atual.
*   `review_date`: Timestamp.
*   `is_read`: Boolean - Se foi lido no painel.
*   `site_slug`: String (FK).
*   `location_id`: String - ID da localização associada.

### `google_reply_history`
Histórico de versões de respostas enviadas.
*   `id`: UUID (PK)
*   `review_id`: String (FK `google_reviews.review_id_external`).
*   `reply_text`: Text.
*   `created_at`: Timestamp.

### `google_settings`
Configurações de notificação e preferências por usuário.
*   `id`: UUID (PK)
*   `user_id`: UUID (FK `auth.users`).
*   `site_slug`: String.
*   `notify_new_review`: Boolean.
*   `notify_negative_review`: Boolean.
*   `email_alerts`: Boolean.
