-- ============================================================================
-- INVESTIGAÇÃO: Mensagens Marcadas como SENT mas sem Resposta do N8N
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Identificar mensagens que foram marcadas como SENT mas não têm
--            resposta do N8N salva (enviadas antes da correção)
-- ============================================================================

-- 1. MENSAGENS SENT SEM RESPOSTA DO N8N (ÚLTIMAS 24H)
-- ============================================================================
-- Estas mensagens foram enviadas ANTES da correção que salva resposta do N8N
-- Precisamos verificar logs do Netlify Functions para ver o que realmente aconteceu
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.sent_at,
    q.error_message,
    q.retry_count,
    s.name as store_name,
    q.message_type,
    q.priority,
    q.metadata->>'source' as source,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'sale_id' as sale_id,
    q.metadata->>'colaboradora' as colaboradora,
    EXTRACT(EPOCH FROM (q.sent_at - q.created_at)) as tempo_processamento_segundos,
    CASE 
        WHEN q.sent_at IS NULL THEN '⚠️ SEM TIMESTAMP DE ENVIO'
        WHEN q.metadata->'n8n_response' IS NULL THEN '⚠️ SEM RESPOSTA DO N8N SALVA (enviada antes da correção)'
        ELSE '✅ TEM RESPOSTA SALVA'
    END as status_investigacao
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SENT'
AND q.metadata->'n8n_response' IS NULL
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.sent_at DESC
LIMIT 50;

-- 2. VERIFICAR SE HÁ PADRÃO DE FALHA POR TELEFONE
-- ============================================================================
-- Identificar números que receberam muitas mensagens "SENT" mas podem não ter chegado
SELECT 
    q.phone,
    COUNT(*) as total_mensagens_sent,
    COUNT(CASE WHEN q.metadata->'n8n_response' IS NULL THEN 1 END) as sem_resposta_n8n,
    COUNT(CASE WHEN q.metadata->'n8n_response' IS NOT NULL THEN 1 END) as com_resposta_n8n,
    MIN(q.created_at) as primeira_mensagem,
    MAX(q.created_at) as ultima_mensagem,
    s.name as store_name
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SENT'
AND q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY q.phone, s.name
ORDER BY total_mensagens_sent DESC;

-- 3. MENSAGENS POR HORÁRIO (PARA IDENTIFICAR PADRÕES)
-- ============================================================================
SELECT 
    DATE_TRUNC('hour', q.sent_at) as hora,
    COUNT(*) as total_mensagens,
    COUNT(CASE WHEN q.metadata->'n8n_response' IS NULL THEN 1 END) as sem_resposta,
    COUNT(CASE WHEN q.metadata->'n8n_response' IS NOT NULL THEN 1 END) as com_resposta,
    ROUND(AVG(EXTRACT(EPOCH FROM (q.sent_at - q.created_at))), 2) as tempo_medio_segundos
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.status = 'SENT'
AND q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', q.sent_at)
ORDER BY hora DESC;

-- 4. COMPARAR MENSAGENS COM E SEM RESPOSTA DO N8N
-- ============================================================================
SELECT 
    CASE 
        WHEN q.metadata->'n8n_response' IS NULL THEN 'SEM RESPOSTA N8N'
        ELSE 'COM RESPOSTA N8N'
    END as tipo,
    COUNT(*) as quantidade,
    ROUND(AVG(EXTRACT(EPOCH FROM (q.sent_at - q.created_at))), 2) as tempo_medio_segundos,
    MIN(q.created_at) as primeira,
    MAX(q.created_at) as ultima
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.status = 'SENT'
AND q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY CASE 
    WHEN q.metadata->'n8n_response' IS NULL THEN 'SEM RESPOSTA N8N'
    ELSE 'COM RESPOSTA N8N'
END;

-- 5. INSTRUÇÕES PARA VERIFICAR LOGS DO NETLIFY
-- ============================================================================
-- Para investigar essas mensagens, você precisa:
-- 1. Acessar o Netlify Dashboard
-- 2. Ir em Functions > process-whatsapp-queue
-- 3. Verificar logs no horário de envio (sent_at)
-- 4. Procurar por logs que mostram a resposta do N8N
-- 
-- Exemplo de busca nos logs:
-- - Procurar pelo ID da mensagem: "f39af50f-b1c7-4580-a793-68534d17fd79"
-- - Procurar por "[ProcessWhatsAppQueue] Resposta do send-whatsapp-message"
-- - Verificar se há erros ou respostas inesperadas do N8N

