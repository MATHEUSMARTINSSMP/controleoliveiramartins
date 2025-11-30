# Edge Function: Processar Fila de WhatsApp de Cashback

Esta Edge Function processa a fila de WhatsApp de cashback automaticamente.

## Funcionalidade

- Busca mensagens pendentes na fila
- Processa até 10 mensagens por execução
- Chama a Netlify Function para enviar WhatsApp
- Atualiza status da fila (SENT, SKIPPED, FAILED)
- Suporta até 3 tentativas antes de marcar como FAILED

## Configuração

### Variáveis de Ambiente

As variáveis são configuradas automaticamente pelo Supabase:
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço

A URL do Netlify é buscada da tabela `app_config` (chave: `netlify_url`).

## Uso Manual

```bash
curl -X POST https://seu-projeto.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Agendamento Automático

Configure um Scheduled Job no Supabase Dashboard para executar a cada 1 minuto.

