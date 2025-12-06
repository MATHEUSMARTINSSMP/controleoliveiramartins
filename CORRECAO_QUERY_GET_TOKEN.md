# 🔧 Correção: Query "PostgreSQL - Get Token"

## ❌ Erro Identificado

```
column "uazapi_admin_token" does not exist
```

A query estava tentando buscar `uazapi_admin_token` da tabela `whatsapp_credentials`, mas essa coluna **NÃO EXISTE** nessa tabela.

## 📋 Estrutura da Tabela `whatsapp_credentials`

A tabela `whatsapp_credentials` contém apenas:

- `customer_id`
- `site_slug`
- `uazapi_instance_id`
- `uazapi_token` ← Token da instância (NÃO é o admin token)
- `uazapi_phone_number`
- `uazapi_qr_code`
- `uazapi_status`
- `whatsapp_instance_name`
- `chatwoot_*` (várias colunas do Chatwoot)
- `status`
- `instance_metadata`

## ✅ Onde está cada token:

1. **`uazapi_admin_token`** (Global):
   - Tabela: `sistemaretiradas.uazapi_config`
   - É buscado no node **"PostgreSQL - Get Config"**
   - É usado para criar instâncias

2. **`uazapi_token`** (Por loja):
   - Tabela: `sistemaretiradas.whatsapp_credentials`
   - É buscado no node **"PostgreSQL - Get Token"**
   - É usado para enviar mensagens

## 🔧 Query Corrigida

### ❌ INCORRETO:
```sql
SELECT 
  uazapi_admin_token,  -- ← ERRO: Esta coluna não existe!
  uazapi_token,
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;
```

### ✅ CORRETO:
```sql
SELECT 
  uazapi_token,        -- ← Token da instância (para enviar mensagens)
  uazapi_instance_id,
  uazapi_status
FROM sistemaretiradas.whatsapp_credentials
WHERE customer_id = $1 
  AND site_slug = $2 
  AND status = 'active'
LIMIT 1;
```

## 📝 Nota Importante

O `uazapi_admin_token` **JÁ É BUSCADO** no node anterior "PostgreSQL - Get Config" e passa para os próximos nodes. Não precisa buscar novamente na tabela `whatsapp_credentials`.

---

## 🎯 Resumo

- **Remover** `uazapi_admin_token` da query "PostgreSQL - Get Token"
- A query deve buscar apenas `uazapi_token`, `uazapi_instance_id` e `uazapi_status`
- O `uazapi_admin_token` vem do node "PostgreSQL - Get Config"

