# ⚡ PROCESSAR FILA DE WHATSAPP AGORA - Guia Rápido

## 🎯 Objetivo
Processar as mensagens pendentes na fila de WhatsApp de cashback.

## ✅ Método Mais Rápido: Supabase Dashboard

1. **Acesse:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc/functions
2. **Clique** em `process-cashback-queue`
3. **Clique** em `Invoke`
4. **Body:** `{}`
5. **Authorization:** `Bearer SUA_SERVICE_ROLE_KEY`
6. **Clique** em `Invoke Function`

✅ Pronto! A fila será processada imediatamente.

## 🔄 Método Alternativo: Terminal

```bash
# 1. Definir variável de ambiente
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"

# 2. Executar script
node PROCESSAR_FILA_AGORA.js
```

## 📊 Verificar Resultado

Execute no Supabase SQL Editor:

```sql
SELECT 
    status,
    COUNT(*) as total
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status;
```

## 🔗 Links Úteis

- **Edge Function:** https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue
- **Supabase Dashboard:** https://supabase.com/dashboard/project/kktsbnrnlnzyofupegjc
- **Ver Fila:** Execute a query SQL acima

## ⚙️ Configurar Automático

Para processar automaticamente a cada minuto, configure um Scheduled Job no Supabase Dashboard.

Veja instruções completas em: `INSTRUCOES_PROCESSAR_FILA_AGORA.md`

