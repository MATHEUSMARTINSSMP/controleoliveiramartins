# ⚡ Agendar Processamento Automático - Guia Simples

## ✅ Edge Function Criada!

URL: `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`

---

## 🎯 OPÇÃO MAIS SIMPLES: Usar n8n (Se você já usa)

### Configurar no n8n:

1. **Criar novo workflow**
2. **Adicionar trigger:**
   - Tipo: **Cron**
   - Cron Expression: `*/1 * * * *` (a cada 1 minuto)
3. **Adicionar nó HTTP Request:**
   - **Method:** POST
   - **URL:** `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`
   - **Authentication:** Header Auth
     - **Name:** `Authorization`
     - **Value:** `Bearer SEU_SERVICE_ROLE_KEY_AQUI`
   - **Headers:**
     - `Content-Type: application/json`
   - **Body:** `{}`
4. **Salvar e ativar workflow**

**Pronto!** Vai executar automaticamente a cada 1 minuto.

---

## 🔧 OU: Testar Manualmente Primeiro

Antes de agendar, teste se a função está funcionando:

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Se retornar `{"success": true, ...}`, está funcionando! ✅

---

## 📋 OUTRAS OPÇÕES

Veja o arquivo `CONFIGURAR_AGENDAMENTO_AGORA.md` para mais opções:
- pg_cron (via SQL)
- Serviços externos (EasyCron, etc.)

---

## ✅ VERIFICAR SE ESTÁ FUNCIONANDO

Depois de agendar, execute no Supabase SQL Editor:

```sql
-- Ver mensagens pendentes (deve diminuir)
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga,
    NOW() - MIN(created_at) as tempo_na_fila
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

Se o número diminuir com o tempo, está funcionando! 🎉

---

**Qual opção você quer usar?**

