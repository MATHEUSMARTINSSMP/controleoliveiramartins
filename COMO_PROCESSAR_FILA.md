# ⚡ Como Processar Fila de WhatsApp AGORA

## 🔴 PROBLEMA

A extensão `pg_net` não está habilitada no Supabase, então não podemos processar a fila via SQL diretamente.

## ✅ SOLUÇÕES DISPONÍVEIS

### **Opção 1: cURL (Mais Rápido - Recomendado)**

Execute no terminal:

```bash
curl -X POST https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue
```

**Vantagens:**
- ✅ Não precisa instalar nada
- ✅ Funciona imediatamente
- ✅ Mais simples

---

### **Opção 2: Script Node.js**

Execute no terminal:

```bash
# Definir chave do Supabase
export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"

# Executar script
node PROCESSAR_FILA_AGORA.js
```

**Vantagens:**
- ✅ Mostra estatísticas detalhadas
- ✅ Verifica resultado após processar
- ✅ Mais informativo

**Desvantagens:**
- ⚠️ Precisa ter Node.js instalado
- ⚠️ Precisa da chave do Supabase

---

### **Opção 3: Habilitar pg_net (Avançado)**

Se quiser processar via SQL, primeiro habilite a extensão:

#### Passo 1: Habilitar pg_net

1. Acesse **Supabase Dashboard**
2. Vá em **Database > Extensions**
3. Procure por **`pg_net`**
4. Clique em **Enable**

#### Passo 2: Executar Query SQL

Depois de habilitar, execute:

```sql
SELECT net.http_post(
    url := 'https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
) as request_id;
```

---

## 🎯 RECOMENDAÇÃO

**Para processar agora (urgente):**
- Use **Opção 1 (cURL)** - é a mais rápida

**Para automação permanente:**
- Configure o cron job (veja `URGENTE_PROCESSAR_FILA.md`)

---

## 🔍 VERIFICAR SE FUNCIONOU

Depois de processar, execute no Supabase SQL Editor:

```sql
-- Ver mensagens pendentes
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga,
    NOW() - MIN(created_at) as tempo_mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

Se `total_pendentes` diminuir, funcionou! ✅

