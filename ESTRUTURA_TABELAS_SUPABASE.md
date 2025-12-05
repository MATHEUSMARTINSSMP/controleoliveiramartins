# 📋 Estrutura das Tabelas no Supabase

## Tabela: `erp_integrations`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | `gen_random_uuid()` | ID único da integração |
| `store_id` | uuid | NO | - | ID da loja |
| `sistema_erp` | text | NO | - | Sistema ERP (TINY, BLING, etc.) |
| `client_id` | text | NO | - | Client ID do OAuth |
| `client_secret` | text | NO | - | Client Secret do OAuth |
| `access_token` | text | YES | - | Token de acesso OAuth |
| `refresh_token` | text | YES | - | Token de refresh OAuth |
| `token_expires_at` | timestamp | YES | - | Data de expiração do token |
| `last_sync_at` | timestamp | YES | - | Última sincronização |
| `sync_status` | text | YES | `'DISCONNECTED'` | Status da sincronização |
| `error_message` | text | YES | - | Mensagem de erro (se houver) |
| `config_adicional` | jsonb | YES | - | Configurações adicionais |
| `created_at` | timestamp | YES | `now()` | Data de criação |
| `updated_at` | timestamp | YES | `now()` | Data de atualização |
| `active` | boolean | YES | `true` | Se está ativo |

**Status possíveis para `sync_status`:**
- `DISCONNECTED` - Não conectado
- `CONNECTED` - Conectado e funcionando
- `ERROR` - Erro na conexão

---

## Tabela: `stores`

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | uuid | NO | `uuid_generate_v4()` | ID único da loja |
| `name` | text | NO | - | Nome da loja |
| `active` | boolean | YES | `true` | Se está ativa |
| `created_at` | timestamp with time zone | YES | `now()` | Data de criação |
| `updated_at` | timestamp with time zone | YES | `now()` | Data de atualização |
| `admin_id` | uuid | YES | - | ID do admin responsável |
| `sistema_erp` | text | YES | - | Sistema ERP padrão da loja |
| `cashback_ativo` | boolean | YES | `false` | Se módulo cashback está ativo |
| `crm_ativo` | boolean | NO | `false` | Se módulo CRM está ativo |
| `ponto_ativo` | boolean | YES | `false` | Se módulo ponto está ativo |
| `wishlist_ativo` | boolean | YES | `false` | Se módulo wishlist está ativo |
| `uazapi_token` | text | YES | - | Token UazAPI para WhatsApp |
| `uazapi_instance_id` | text | YES | - | ID da instância UazAPI |
| `whatsapp_ativo` | boolean | YES | `false` | Se WhatsApp está ativo |
| `whatsapp_connection_status` | text | YES | `'disconnected'` | Status da conexão WhatsApp |
| `whatsapp_connected_at` | timestamp with time zone | YES | - | Data da conexão WhatsApp |

**Status possíveis para `whatsapp_connection_status`:**
- `disconnected` - Desconectado
- `connecting` - Conectando
- `connected` - Conectado
- `error` - Erro na conexão

---

## 🔍 Queries de Verificação

### Verificar todas as lojas:
```sql
SELECT 
    id,
    name,
    active,
    sistema_erp,
    cashback_ativo,
    crm_ativo,
    ponto_ativo,
    wishlist_ativo,
    whatsapp_ativo
FROM sistemaretiradas.stores
ORDER BY name;
```

### Verificar integrações ERP:
```sql
SELECT 
    ei.id,
    s.name as loja,
    ei.sistema_erp,
    ei.sync_status,
    LEFT(ei.client_id, 20) || '...' as client_id_preview,
    ei.last_sync_at,
    ei.error_message,
    ei.active
FROM sistemaretiradas.erp_integrations ei
LEFT JOIN sistemaretiradas.stores s ON s.id = ei.store_id
ORDER BY s.name;
```

### Verificar lojas com integração configurada:
```sql
SELECT 
    s.id,
    s.name,
    ei.sistema_erp,
    ei.sync_status,
    ei.last_sync_at
FROM sistemaretiradas.stores s
INNER JOIN sistemaretiradas.erp_integrations ei ON ei.store_id = s.id
WHERE ei.active = true
ORDER BY s.name;
```

### Verificar lojas sem integração:
```sql
SELECT 
    s.id,
    s.name,
    s.active
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.erp_integrations ei ON ei.store_id = s.id AND ei.active = true
WHERE ei.id IS NULL
ORDER BY s.name;
```

---

## ✅ Checklist de Verificação

- [ ] Todas as lojas aparecem na lista?
- [ ] As integrações ERP estão sendo salvas corretamente?
- [ ] Os tokens (client_id, client_secret) estão sendo salvos?
- [ ] O status de sincronização está sendo atualizado?
- [ ] A última sincronização está sendo registrada?
- [ ] As mensagens de erro estão sendo salvas?

