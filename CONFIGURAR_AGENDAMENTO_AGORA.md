# ⚡ Configurar Agendamento Automático - Passo a Passo

## ✅ Edge Function Criada!

Sua função está disponível em:
`https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`

Agora vamos configurar para executar **automaticamente a cada 1 minuto**.

---

## 📋 OPÇÕES PARA AGENDAR

### **Opção 1: Usar Supabase Scheduled Jobs (Recomendado)**

O Supabase tem uma interface para agendar jobs. Vamos verificar se está disponível:

1. Acesse **Supabase Dashboard**
2. Procure por:
   - **Database > Database > Scheduled Jobs**, ou
   - **Database > Cron Jobs**, ou
   - **Edge Functions > process-cashback-queue > Schedule**

Se encontrar essa opção, use-a!

---

### **Opção 2: Usar pg_cron (Se habilitado)**

Execute no **Supabase SQL Editor**:

```sql
-- 1. Verificar se pg_cron está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Se não estiver, tentar habilitar (pode precisar de permissões de superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Criar função helper para chamar a Edge Function
CREATE OR REPLACE FUNCTION sistemaretiradas.chamar_processar_fila_whatsapp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
    v_service_key TEXT;
    v_response TEXT;
BEGIN
    -- Obter URL do Supabase
    SELECT value INTO v_service_key
    FROM sistemaretiradas.app_config
    WHERE key = 'service_role_key';
    
    -- URL da Edge Function
    v_url := 'https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue';
    
    -- Tentar chamar via http extension (se disponível)
    BEGIN
        -- Usar http extension se disponível
        SELECT content INTO v_response
        FROM http((
            'POST',
            v_url,
            ARRAY[
                http_header('Authorization', 'Bearer ' || v_service_key),
                http_header('Content-Type', 'application/json')
            ],
            'application/json',
            '{}'
        )::http_request);
        
        RETURN 'Chamada realizada: ' || COALESCE(v_response, 'Sem resposta');
    EXCEPTION WHEN OTHERS THEN
        RETURN 'Erro: ' || SQLERRM;
    END;
END;
$$;

-- 4. Agendar para executar a cada 1 minuto
SELECT cron.schedule(
    'processar-fila-whatsapp-cashback',
    '* * * * *', -- A cada minuto
    $$
    SELECT sistemaretiradas.chamar_processar_fila_whatsapp();
    $$
);
```

**⚠️ Nota:** Isso requer que `pg_cron` e `http` extensions estejam habilitadas.

---

### **Opção 3: Usar Serviço Externo (Mais Confiável)**

Se as opções acima não funcionarem, use um serviço externo:

#### Usando n8n (se você já usa):

1. Crie um workflow no n8n
2. Adicione um trigger **Cron** (a cada 1 minuto)
3. Adicione um nó **HTTP Request**:
   - **Method:** POST
   - **URL:** `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`
   - **Authentication:** Header Auth
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer SEU_SERVICE_ROLE_KEY`
4. Salve e ative o workflow

#### Usando EasyCron ou similar:

1. Crie conta em [EasyCron](https://www.easycron.com/) ou similar
2. Configure:
   - **URL:** `https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue`
   - **Method:** POST
   - **Headers:** `Authorization: Bearer SEU_SERVICE_ROLE_KEY`
   - **Schedule:** A cada 1 minuto

---

## 🎯 RECOMENDAÇÃO RÁPIDA

**Para testar AGORA (sem agendamento):**

Execute no terminal ou Postman:

```bash
curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
  -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Isso vai processar as mensagens pendentes imediatamente!

**Para automação permanente:**
- Tente primeiro a **Opção 1** (Supabase Scheduled Jobs)
- Se não estiver disponível, use **Opção 3** (serviço externo)

---

## ✅ VERIFICAR SE ESTÁ FUNCIONANDO

Depois de configurar, verifique:

```sql
-- Ver mensagens pendentes (deve diminuir)
SELECT 
    COUNT(*) as total_pendentes,
    MIN(created_at) as mais_antiga,
    NOW() - MIN(created_at) as tempo_na_fila
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';
```

Se o número diminuir com o tempo, está funcionando! ✅

---

**Qual opção você quer tentar primeiro?**

