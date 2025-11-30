-- ============================================================================
-- PROCESSAR FILA DE WHATSAPP USANDO EDGE FUNCTION
-- ============================================================================
-- Esta função agora usa a Edge Function que processa tudo internamente
-- usando a mesma lógica de envio de WhatsApp que já existe no sistema
-- ============================================================================

-- ============================================================================
-- TESTAR EDGE FUNCTION DIRETAMENTE
-- ============================================================================

-- A Edge Function já está pronta em:
-- https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue
--
-- Ela usa EXATAMENTE a mesma lógica de envio de WhatsApp que já existe:
-- - formatCashbackMessage (formatação da mensagem)
-- - sendWhatsAppMessage (envio via webhook n8n)
--
-- Não precisa de extensão HTTP! Basta chamar a URL com o service_role_key

-- ============================================================================
-- VERIFICAR MENSAGENS PENDENTES
-- ============================================================================

SELECT 
    id,
    transaction_id,
    cliente_id,
    store_id,
    status,
    attempts,
    last_attempt_at,
    error_message,
    created_at
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC;

-- ============================================================================
-- TESTAR EDGE FUNCTION (usando ferramenta externa)
-- ============================================================================

-- Como não temos extensão HTTP no PostgreSQL, use uma das opções:

-- OPÇÃO 1: Via cURL (terminal)
-- curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue \
--   -H "Authorization: Bearer SEU_SERVICE_ROLE_KEY" \
--   -H "Content-Type: application/json"

-- OPÇÃO 2: Via Supabase Dashboard > Edge Functions > Invoke
-- 1. Vá em Supabase Dashboard > Edge Functions
-- 2. Clique em "process-cashback-queue"
-- 3. Clique em "Invoke"
-- 4. Body: {}
-- 5. Authorization: Bearer SEU_SERVICE_ROLE_KEY

-- OPÇÃO 3: Configurar Scheduled Job no Supabase Dashboard
-- 1. Vá em Supabase Dashboard > Database > Scheduled Jobs
-- 2. Criar novo Scheduled Job
-- 3. Cron: * * * * * (a cada minuto)
-- 4. Type: HTTP Request
-- 5. URL: https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-cashback-queue
-- 6. Method: POST
-- 7. Headers: Authorization: Bearer SEU_SERVICE_ROLE_KEY

-- ============================================================================
-- VERIFICAR RESULTADO APÓS PROCESSAR
-- ============================================================================

SELECT 
    status,
    COUNT(*) as total,
    STRING_AGG(id::TEXT, ', ') as ids
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status;

-- ============================================================================
-- VER TODAS AS MENSAGENS (últimas 20)
-- ============================================================================

SELECT 
    id,
    status,
    attempts,
    error_message,
    created_at,
    last_attempt_at
FROM sistemaretiradas.cashback_whatsapp_queue
ORDER BY created_at DESC
LIMIT 20;

