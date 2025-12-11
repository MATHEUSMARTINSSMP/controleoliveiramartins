# Edge Function: Processar Fila de Notificações de Ponto

Esta Edge Function processa a fila de notificações de ponto e envia via WhatsApp.

## Funcionalidade

- Busca mensagens pendentes na fila `time_clock_notification_queue`
- Processa até 50 mensagens por execução
- Chama a Netlify Function `send-whatsapp-message` para enviar WhatsApp
- Atualiza status da fila (SENT, FAILED)
- Suporta até 3 tentativas antes de marcar como FAILED

## Configuração

### Variáveis de Ambiente

As variáveis são configuradas automaticamente pelo Supabase:
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço

A URL do Netlify é buscada da tabela `app_config` (chave: `netlify_url`).

## Uso Manual

```bash
curl -X POST https://seu-projeto.supabase.co/functions/v1/process-time-clock-notifications \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Agendamento Automático

O cron job no Supabase chama esta função a cada 1 minuto.

