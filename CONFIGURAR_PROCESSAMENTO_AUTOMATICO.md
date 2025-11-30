# ✅ Configurar Processamento Automático da Fila

## 🎯 OBJETIVO

Processar a fila de WhatsApp de cashback **automaticamente a cada 1 minuto**, sem precisar rodar comandos no terminal.

## 📋 PASSOS

### **Passo 1: Deploy da Edge Function**

A Edge Function já está criada em `supabase/functions/process-cashback-queue/`.

Execute no terminal:

```bash
# Fazer login no Supabase CLI (se ainda não fez)
npx supabase login

# Deploy da função
npx supabase functions deploy process-cashback-queue
```

**Ou via Supabase Dashboard:**

1. Acesse **Supabase Dashboard**
2. Vá em **Edge Functions**
3. Clique em **Create a new function**
4. Cole o conteúdo do arquivo `supabase/functions/process-cashback-queue/index.ts`
5. Nome: `process-cashback-queue`
6. Clique em **Deploy**

---

### **Passo 2: Configurar Scheduled Job (Cron Job)**

1. Acesse **Supabase Dashboard**
2. Vá em **Database > Database > Scheduled Jobs** (ou **Cron Jobs**)
3. Clique em **Create a new scheduled job**

#### Configuração do Job:

- **Name:** `processar-fila-whatsapp-cashback`
- **Schedule:** `* * * * *` (a cada 1 minuto)
- **Command/SQL:** 
  ```sql
  SELECT net.http_post(
      url := 'https://SEU_PROJETO.supabase.co/functions/v1/process-cashback-queue',
      headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT value FROM sistemaretiradas.app_config WHERE key = 'service_role_key'),
          'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
  );
  ```

**⚠️ IMPORTANTE:** Se `pg_net` não estiver habilitado, use a alternativa abaixo.

---

### **Passo 3 (Alternativa): Usar Supabase Scheduled Jobs via Dashboard**

Se `pg_net` não estiver disponível, use a interface do Supabase:

1. Acesse **Supabase Dashboard**
2. Vá em **Edge Functions > process-cashback-queue**
3. Clique em **Schedule** (ou **Create Schedule**)
4. Configure:
   - **Schedule:** `*/1 * * * *` (a cada 1 minuto)
   - **HTTP Method:** POST
   - **Headers:** 
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - **Body:** `{}`

---

### **Passo 4: Verificar Configuração do Netlify URL**

Certifique-se de que a URL do Netlify está configurada:

```sql
-- Verificar se existe
SELECT * FROM sistemaretiradas.app_config WHERE key = 'netlify_url';

-- Se não existir, inserir
INSERT INTO sistemaretiradas.app_config (key, value, description)
VALUES ('netlify_url', 'https://eleveaone.com.br', 'URL base do Netlify para chamar funções')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## ✅ VERIFICAR SE ESTÁ FUNCIONANDO

### 1. Ver logs da Edge Function

1. Acesse **Supabase Dashboard**
2. Vá em **Edge Functions > process-cashback-queue**
3. Clique em **Logs**
4. Verifique se há execuções a cada minuto

### 2. Verificar Fila

Execute no Supabase SQL Editor:

```sql
-- Ver mensagens pendentes (deve diminuir com o tempo)
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga,
    NOW() - MIN(created_at) as tempo_mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

### 3. Ver mensagens enviadas recentemente

```sql
-- Ver últimas mensagens enviadas
SELECT 
    q.id,
    q.status,
    q.created_at,
    q.last_attempt_at,
    q.last_attempt_at - q.created_at as tempo_ate_envio,
    c.nome as cliente_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC
LIMIT 10;
```

---

## 🔧 TROUBLESHOOTING

### Problema: Job não está executando

**Solução:**
- Verifique se o Scheduled Job está **ativo**
- Verifique os logs do Supabase
- Verifique se a Edge Function foi deployada corretamente

### Problema: Mensagens ainda pendentes

**Solução:**
- Verifique logs da Edge Function
- Verifique se a Netlify Function está funcionando
- Verifique se o cliente tem telefone cadastrado

### Problema: Erro ao chamar Edge Function

**Solução:**
- Verifique se a chave de serviço está configurada
- Verifique se a URL do Supabase está correta
- Verifique permissões da Edge Function

---

## 📊 MONITORAMENTO

### Query para ver estatísticas

```sql
SELECT 
    status,
    COUNT(*) as total,
    AVG(EXTRACT(EPOCH FROM (last_attempt_at - created_at)))::INTEGER as tempo_medio_segundos
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## ✅ CONCLUÍDO

Após configurar:

- ✅ Fila será processada automaticamente a cada 1 minuto
- ✅ Não precisa rodar comandos no terminal
- ✅ Mensagens serão enviadas em até 1 minuto após serem criadas
- ✅ Sistema totalmente automático!

**Status:** 🎯 **PRONTO PARA CONFIGURAR**

