-- =====================================================
-- VERIFICAR STATUS DAS REQUISIÇÕES HTTP DO PG_NET
-- =====================================================

-- Verificar status das últimas requisições HTTP
-- Substitua 7119 pelo request_id mais recente que você obteve
SELECT 
    request_id,
    status_code,
    content,
    error_msg,
    created,
    updated
FROM net.http_request_queue
WHERE request_id >= (SELECT MAX(request_id) - 10 FROM net.http_request_queue)
ORDER BY request_id DESC
LIMIT 10;

-- Verificar se há requisições com erro
SELECT 
    request_id,
    status_code,
    error_msg,
    created,
    updated
FROM net.http_request_queue
WHERE error_msg IS NOT NULL
ORDER BY request_id DESC
LIMIT 10;

-- Verificar requisições para a Edge Function especificamente
SELECT 
    request_id,
    status_code,
    LEFT(content, 200) as content_preview,
    error_msg,
    created,
    updated
FROM net.http_request_queue
WHERE url LIKE '%process-time-clock-notifications%'
ORDER BY request_id DESC
LIMIT 10;

