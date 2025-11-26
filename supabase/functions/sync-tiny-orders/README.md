# Edge Function: Sync Tiny Orders

## Descrição

Sincroniza automaticamente pedidos do Tiny ERP para todas as lojas com integração ativa.

## Execução

- **Agendada:** A cada 30 minutos via pg_cron
- **Manual:** Pode ser chamada via HTTP POST

## Endpoint

```
POST https://SEU_PROJETO.supabase.co/functions/v1/sync-tiny-orders
```

## Autenticação

Require `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`

## Variáveis de Ambiente Necessárias

- `SUPABASE_URL` - Configurado automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` - Configurar como secret no Supabase Dashboard
- `NETLIFY_FUNCTION_URL` (opcional) - URL do site Netlify

## Resposta

```json
{
  "success": true,
  "message": "Sincronização concluída: X pedidos sincronizados",
  "total_synced": 10,
  "total_updated": 5,
  "total_errors": 0,
  "results": [
    {
      "store_id": "uuid",
      "store_name": "Nome da Loja",
      "success": true,
      "synced": 10,
      "updated": 5,
      "errors": 0,
      "message": "Sincronização concluída"
    }
  ]
}
```

