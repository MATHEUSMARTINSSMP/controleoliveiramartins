# ⚡ Processar Mensagens Pendentes AGORA

## 🔴 SITUAÇÃO ATUAL

Você tem **2 mensagens PENDING** há mais de 10 minutos:
1. **Ameliane Azevedo** - Criada às 19:20:17 (R$ 69,00)
2. **Matheus Martins Pinheiro** - Criada às 19:18:05 (R$ 150,00)

Ambas com **0 tentativas**, o que indica que o processamento automático **não está funcionando**.

---

## ✅ SOLUÇÃO IMEDIATA: Processar Manualmente

### Opção 1: Chamar Edge Function Diretamente

Execute no terminal ou Postman:

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Isso vai processar até 10 mensagens pendentes imediatamente!

---

### Opção 2: Verificar e Corrigir Cron Job

1. **Verificar se o cron job existe:**

Execute no Supabase SQL Editor:

```sql
SELECT * FROM cron.job 
WHERE jobname = 'processar-fila-whatsapp-cashback';
```

Se não retornar nada, o job não está configurado.

2. **Se não existir, criar:**

Execute a migration `20250131000010_scheduled_job_processar_fila.sql`

Ou execute manualmente:

```sql
-- Verificar se pg_cron está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se não estiver, habilitar (pode precisar de permissões de admin)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 🔍 DIAGNÓSTICO

### Por que as mensagens estão pendentes?

1. **Cron job não configurado** - O job não foi criado
2. **Cron job desativado** - O job existe mas está `active = false`
3. **pg_cron não habilitado** - A extensão não está disponível
4. **Erro no job** - O job está executando mas falhando

---

## 📋 CHECKLIST

- [ ] Verificar se pg_cron está habilitado
- [ ] Verificar se o cron job existe
- [ ] Verificar se o cron job está ativo
- [ ] Verificar logs de execução do job
- [ ] Processar mensagens pendentes manualmente
- [ ] Verificar se as mensagens foram processadas

---

## ✅ DEPOIS DE PROCESSAR

Execute novamente a query para verificar:

```sql
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

Se o número diminuir, funcionou! ✅

---

**AÇÃO URGENTE:** Processe as mensagens manualmente agora e depois verifique o cron job!

