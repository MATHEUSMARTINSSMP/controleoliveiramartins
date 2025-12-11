-- =====================================================
-- VERIFICAR ERROS ESPECÍFICOS DAS NOTIFICAÇÕES FALHADAS
-- =====================================================

SELECT 
    id,
    time_clock_record_id,
    store_id,
    phone,
    status,
    attempts,
    error_message,
    created_at,
    sent_at,
    SUBSTRING(message, 1, 200) as mensagem_preview
FROM sistemaretiradas.time_clock_notification_queue
WHERE status = 'FAILED'
ORDER BY created_at DESC;

