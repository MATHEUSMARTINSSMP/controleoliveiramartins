# ✅ Verificação Completa das Migrations do Google

## 📋 Resumo da Verificação

Verificação completa de todas as migrations relacionadas ao Google My Business para garantir consistência e correção.

---

## ✅ Migrations Verificadas

1. `20251226000003_create_google_integration_tables.sql` ✅
2. `20251226000004_create_google_business_accounts.sql` ✅
3. `20251226000005_create_cron_sync_google_reviews.sql` ✅
4. `20251226000006_add_indexes_google_reviews.sql` ✅
5. `20251226000007_add_profile_picture_to_google_credentials.sql` ✅
6. `20251226000008_create_google_reply_history.sql` ✅
7. `20251226000009_create_google_settings.sql` ✅
8. `20251227000001_add_location_id_to_google_credentials.sql` ✅

---

## ✅ Correções Aplicadas

### 1. Schema Correto
- ✅ Todas as migrations usam schema `sistemaretiradas`
- ✅ Nenhuma referência ao schema antigo `elevea`

### 2. Coluna `site_slug` Corrigida
- ✅ Todas as RLS policies corrigidas de `s.slug` para `s.site_slug`
- ✅ Correções aplicadas em:
  - `20251226000003_create_google_integration_tables.sql` (2 correções)
  - `20251226000004_create_google_business_accounts.sql` (1 correção)
  - `20251226000008_create_google_reply_history.sql` (2 correções)
  - `20251226000009_create_google_settings.sql` (3 correções)

### 3. Tabelas Criadas

#### `google_credentials`
- ✅ Schema: `sistemaretiradas`
- ✅ PK: `(customer_id, site_slug)`
- ✅ Colunas: `location_id` (opcional), `profile_picture_url`, tokens OAuth
- ✅ Índices: status, expires_at, location_id (quando não nulo)
- ✅ Triggers: updated_at automático
- ✅ RLS: Policies corretas usando `s.site_slug`

#### `google_reviews`
- ✅ Schema: `sistemaretiradas`
- ✅ PK: `review_id` (SERIAL)
- ✅ Unique: `(customer_id, site_slug, review_id_external)`
- ✅ Colunas: account_id, location_id, is_read
- ✅ Índices: Compostos para performance
- ✅ Triggers: updated_at automático
- ✅ RLS: Policies corretas usando `s.site_slug`

#### `google_business_accounts`
- ✅ Schema: `sistemaretiradas`
- ✅ PK: `id` (SERIAL)
- ✅ Unique: `(customer_id, site_slug, account_id, location_id)`
- ✅ Colunas: Dados completos de accounts e locations
- ✅ Índices: customer_site, account, location, primary
- ✅ Triggers: updated_at automático
- ✅ RLS: Policies corretas usando `s.site_slug`

#### `google_reply_history`
- ✅ Schema: `sistemaretiradas`
- ✅ PK: `id` (SERIAL)
- ✅ FK: `review_id` → `google_reviews(review_id)` ON DELETE CASCADE
- ✅ Índices: review_id
- ✅ RLS: Policies corretas usando `s.site_slug`

#### `google_settings`
- ✅ Schema: `sistemaretiradas`
- ✅ PK: `id` (SERIAL)
- ✅ Unique: `(customer_id, site_slug)`
- ✅ RLS: Policies corretas usando `s.site_slug`

---

## ✅ Funções SQL Verificadas

### `sync_google_reviews_automatico()`
- ✅ Schema: `sistemaretiradas`
- ✅ Usa `sistemaretiradas.app_config` para configurações
- ✅ Função de cron job para sincronização automática

### `update_updated_at_column()`
- ✅ Schema: `sistemaretiradas`
- ✅ Função reutilizável para triggers updated_at

---

## ✅ RLS Policies Verificadas

Todas as RLS policies foram verificadas e corrigidas:

1. ✅ **google_credentials** - Policies de SELECT e ALL (gerenciamento)
2. ✅ **google_reviews** - Policies de SELECT e ALL (gerenciamento)
3. ✅ **google_business_accounts** - Policies de SELECT e ALL (gerenciamento)
4. ✅ **google_reply_history** - Policies de SELECT e INSERT
5. ✅ **google_settings** - Policies de SELECT, UPDATE e INSERT

**Todas as policies** usam:
- ✅ `s.site_slug` (corrigido de `s.slug`)
- ✅ Verificação correta de acesso via `stores` e `profiles`

---

## ✅ Índices Verificados

Todos os índices estão corretos:
- ✅ Índices simples (status, expires_at, etc.)
- ✅ Índices compostos (customer_id, site_slug, ...)
- ✅ Índices parciais (WHERE clauses)
- ✅ Todos usando schema `sistemaretiradas`

---

## ✅ Triggers Verificados

Todos os triggers estão corretos:
- ✅ `update_google_credentials_updated_at`
- ✅ `update_google_reviews_updated_at`
- ✅ `update_google_business_accounts_updated_at`
- ✅ Todos usam função `sistemaretiradas.update_updated_at_column()`

---

## ✅ Foreign Keys Verificadas

### `google_reply_history`
- ✅ `review_id` → `google_reviews(review_id)` ON DELETE CASCADE
- ✅ Schema correto: `sistemaretiradas`

---

## ✅ Comentários e Documentação

- ✅ Todos os comentários estão corretos
- ✅ Descriptions claras em todas as tabelas e colunas
- ✅ Schema indicado nos comentários

---

## ⚠️ Notas Importantes

### Chave Primária do `google_credentials`

A PK é `(customer_id, site_slug)`, **NÃO inclui `location_id`**.

**Design atual**:
- Cada `(customer_id, site_slug)` tem apenas UMA credencial
- `location_id` é um campo opcional para indicar qual location do Google essa credencial representa
- Quando há múltiplas locations, cada location pode ser mapeada para um `site_slug` diferente

**Upsert no código**:
- O callback OAuth usa: `onConflict: 'customer_id,site_slug'` ✅
- O LocationMapping usa: `onConflict: 'customer_id,site_slug'` ✅
- Ambos estão corretos conforme o design

### `location_id` Opcional

A coluna `location_id` foi adicionada como opcional (NULL permitido):
- Quando `NULL`: Credencial principal/genérica
- Quando preenchido: Credencial específica para aquela location do Google

Isso permite:
- ✅ 1 conta Google → múltiplas lojas (cada location → um site_slug)
- ✅ Cada loja tem sua própria credencial (mesmo customer_id, mas site_slug diferente)
- ✅ Cada credencial pode ter um location_id específico

---

## ✅ Status Final

**TODAS AS MIGRATIONS ESTÃO CORRETAS** ✅

- ✅ Schema correto (`sistemaretiradas`)
- ✅ Colunas corretas (`site_slug` ao invés de `slug`)
- ✅ RLS policies corretas
- ✅ Foreign keys corretas
- ✅ Índices corretos
- ✅ Triggers corretos
- ✅ Chaves primárias corretas
- ✅ Documentação completa

**Pronto para executar as migrations!** 🚀

