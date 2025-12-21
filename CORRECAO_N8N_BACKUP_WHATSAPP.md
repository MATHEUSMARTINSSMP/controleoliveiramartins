# Correção Necessária no N8N - Status de Backup WhatsApp

## Problema

O workflow do N8N que trata do endpoint `/webhook/api/whatsapp/auth/status` está tentando buscar backups WhatsApp na tabela errada.

**Situação atual:**
- O N8N recebe: `siteSlug: "mrkitsch_backup1"` (ou similar) e `whatsapp_account_id: "uuid-do-backup"`
- O N8N busca em: `whatsapp_credentials` usando `site_slug`
- Resultado: Não encontra nada porque backups não estão em `whatsapp_credentials`

**O que deveria acontecer:**
- Quando recebe `whatsapp_account_id`, buscar em `whatsapp_accounts` usando o ID
- Quando NÃO recebe `whatsapp_account_id`, buscar em `whatsapp_credentials` usando `site_slug`

## Estrutura das Tabelas

### `whatsapp_credentials` (Número Principal)
- Usado para números principais das lojas
- Busca por: `site_slug` + `admin_id`
- Campos: `uazapi_status`, `uazapi_token`, `uazapi_instance_id`, `uazapi_phone_number`, etc.

### `whatsapp_accounts` (Números de Backup)
- Usado para números reserva/backup (BACKUP_1, BACKUP_2, BACKUP_3)
- Busca por: `id` (whatsapp_account_id)
- Campos: `uazapi_status`, `uazapi_token`, `uazapi_instance_id`, `phone`, etc.

## Correção Necessária no N8N

No workflow do endpoint `/webhook/api/whatsapp/auth/status`, adicionar lógica condicional:

```sql
-- Se whatsapp_account_id foi fornecido, buscar em whatsapp_accounts
IF whatsapp_account_id IS NOT NULL THEN
  SELECT
    wa.id,
    wa.phone as uazapi_phone_number,
    wa.uazapi_instance_id,
    wa.uazapi_token,
    wa.uazapi_status,
    wa.uazapi_qr_code,
    wa.is_connected,
    wa.created_at,
    wa.updated_at
  FROM sistemaretiradas.whatsapp_accounts wa
  WHERE wa.id = whatsapp_account_id::uuid;
  
-- Caso contrário, buscar em whatsapp_credentials (número principal)
ELSE
  SELECT
    wc.admin_id,
    wc.site_slug,
    wc.uazapi_instance_id,
    wc.uazapi_token,
    wc.uazapi_status,
    wc.uazapi_qr_code,
    wc.uazapi_phone_number,
    wc.chatwoot_inbox_id,
    wc.created_at,
    wc.updated_at
  FROM sistemaretiradas.whatsapp_credentials wc
  JOIN sistemaretiradas.stores s ON s.admin_id = wc.admin_id AND s.site_slug = wc.site_slug
  WHERE wc.site_slug = site_slug_param
    AND wc.status = 'active'
  LIMIT 1;
END IF;
```

## Parâmetros Recebidos

O endpoint recebe via query string:
- `siteSlug`: Site slug da loja principal (ex: "mrkitsch")
- `customerId`: Email do admin (ex: "matheusmartinss@icloud.com")
- `whatsapp_account_id`: (OPCIONAL) UUID do registro em `whatsapp_accounts` quando é backup

## Exemplo de Requisições

### Número Principal
```
GET /webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com
```
→ Buscar em `whatsapp_credentials`

### Número Backup
```
GET /webhook/api/whatsapp/auth/status?siteSlug=mrkitsch&customerId=matheusmartinss@icloud.com&whatsapp_account_id=13ad14df-47b6-408c-8491-1e1e3eea3020
```
→ Buscar em `whatsapp_accounts` usando o `whatsapp_account_id`

## Nota Importante

O `site_slug` passado pode vir como "mrkitsch_backup1" em alguns casos, mas isso NÃO é um site_slug válido na tabela `whatsapp_credentials`. Quando `whatsapp_account_id` está presente, **sempre** buscar em `whatsapp_accounts`, independente do valor de `site_slug`.

