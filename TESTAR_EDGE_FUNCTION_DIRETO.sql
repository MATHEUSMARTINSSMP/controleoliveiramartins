-- =====================================================
-- TESTAR EDGE FUNCTION DIRETAMENTE VIA HTTP
-- =====================================================

-- IMPORTANTE: Execute isso para testar se a Edge Function está funcionando
-- A Edge Function retorna JSON com informações sobre o processamento

-- Opção 1: Via curl (execute no terminal)
-- curl -X POST https://kktsbnrnlnzyofupegjc.supabase.co/functions/v1/process-time-clock-notifications \
--   -H "Content-Type: application/json" \
--   -H "Authorization: Bearer [SEU_SERVICE_ROLE_KEY]" \
--   -d '{}'

-- Opção 2: Verificar se há itens pendentes ANTES de testar
SELECT 
    COUNT(*) as total_pending,
    MIN(created_at) as oldest_pending,
    MAX(created_at) as newest_pending
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING';

-- Opção 3: Verificar detalhes dos itens pendentes
SELECT 
    id,
    phone,
    store_id,
    status,
    attempts,
    created_at,
    LEFT(message, 50) as message_preview
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 5;

-- Depois de testar manualmente a Edge Function (via curl ou Dashboard),
-- execute esta query para ver se os itens foram processados:
SELECT 
    id,
    phone,
    status,
    attempts,
    error_message,
    sent_at,
    created_at
FROM sistemaretiradas.time_clock_notification_queue
WHERE id IN (
    SELECT id FROM sistemaretiradas.time_clock_notification_queue 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 5
)
ORDER BY created_at ASC;

