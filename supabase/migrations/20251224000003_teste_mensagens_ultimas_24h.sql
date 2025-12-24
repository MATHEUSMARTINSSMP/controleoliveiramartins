-- ============================================================================
-- TESTE: Status de Mensagens WhatsApp nas Últimas 24 Horas
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Verificar se mensagens estão funcionando e identificar falhas
-- ============================================================================

-- 1. RESUMO GERAL DE MENSAGENS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    'TOTAL DE MENSAGENS' as metrica,
    COUNT(*)::text as valor,
    '' as detalhes
FROM sistemaretiradas.whatsapp_message_queue
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS ENVIADAS COM SUCESSO' as metrica,
    COUNT(*)::text as valor,
    ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM sistemaretiradas.whatsapp_message_queue WHERE created_at >= NOW() - INTERVAL '24 hours'), 0), 2)::text || '%' as detalhes
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'SENT'
AND created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS PENDENTES' as metrica,
    COUNT(*)::text as valor,
    'Aguardando processamento' as detalhes
FROM sistemaretiradas.whatsapp_message_queue
WHERE status IN ('PENDING', 'SCHEDULED')
AND created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS FALHADAS' as metrica,
    COUNT(*)::text as valor,
    'Ver detalhes abaixo' as detalhes
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'FAILED'
AND created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'MENSAGENS EM PROCESSAMENTO' as metrica,
    COUNT(*)::text as valor,
    'Sendo enviadas agora' as detalhes
FROM sistemaretiradas.whatsapp_message_queue
WHERE status = 'SENDING'
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY metrica;

-- 2. MENSAGENS FALHADAS COM DETALHES (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    LEFT(q.message, 100) as message_preview,
    q.status,
    q.error_message,
    q.retry_count,
    q.max_retries,
    q.message_type,
    q.priority,
    s.name as store_name,
    q.created_at,
    q.updated_at,
    q.metadata->>'source' as source,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'fallback_reason' as fallback_reason,
    CASE 
        WHEN q.retry_count >= q.max_retries THEN '❌ LIMITE DE TENTATIVAS ATINGIDO'
        WHEN q.retry_count > 0 THEN '⚠️ SERÁ REPROCESSADA'
        ELSE '⚠️ PRIMEIRA FALHA'
    END as status_retry
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'FAILED'
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 50;

-- 3. MENSAGENS PENDENTES QUE PODEM SER REPROCESSADAS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    LEFT(q.message, 100) as message_preview,
    q.status,
    q.retry_count,
    q.max_retries,
    q.message_type,
    q.priority,
    s.name as store_name,
    q.created_at,
    q.updated_at,
    q.metadata->>'source' as source,
    q.metadata->>'notification_type' as notification_type,
    CASE 
        WHEN q.retry_count > 0 THEN '🔄 RETRY #' || q.retry_count
        ELSE '🆕 NOVA MENSAGEM'
    END as tipo
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status IN ('PENDING', 'SCHEDULED')
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.priority ASC, q.created_at ASC
LIMIT 50;

-- 4. ESTATÍSTICAS POR LOJA (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    s.name as loja,
    COUNT(*) as total_mensagens,
    COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) as enviadas,
    COUNT(CASE WHEN q.status = 'FAILED' THEN 1 END) as falhadas,
    COUNT(CASE WHEN q.status IN ('PENDING', 'SCHEDULED') THEN 1 END) as pendentes,
    COUNT(CASE WHEN q.status = 'SENDING' THEN 1 END) as em_processamento,
    ROUND(
        COUNT(CASE WHEN q.status = 'SENT' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(*), 0), 
        2
    ) as taxa_sucesso_percent
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.name
ORDER BY total_mensagens DESC;

-- 5. MENSAGENS POR TIPO E STATUS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.message_type,
    q.status,
    COUNT(*) as quantidade,
    ROUND(AVG(EXTRACT(EPOCH FROM (q.sent_at - q.created_at))), 2) as tempo_medio_segundos,
    MIN(q.created_at) as primeira,
    MAX(q.created_at) as ultima
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY q.message_type, q.status
ORDER BY q.message_type, q.status;

-- 6. MENSAGENS DE VENDA ESPECÍFICAS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.error_message,
    q.retry_count,
    s.name as store_name,
    q.created_at,
    q.sent_at,
    q.metadata->>'sale_id' as sale_id,
    q.metadata->>'colaboradora' as colaboradora,
    q.metadata->>'source' as source,
    CASE 
        WHEN q.status = 'SENT' THEN '✅ ENVIADA'
        WHEN q.status = 'FAILED' THEN '❌ FALHOU'
        WHEN q.status IN ('PENDING', 'SCHEDULED') THEN '⏳ PENDENTE'
        WHEN q.status = 'SENDING' THEN '📤 ENVIANDO'
        ELSE q.status
    END as status_display
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.metadata->>'notification_type' = 'VENDA'
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 50;

-- 7. ANÁLISE DE ERROS MAIS COMUNS (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    LEFT(q.error_message, 100) as erro,
    COUNT(*) as ocorrencias,
    COUNT(DISTINCT q.phone) as numeros_afetados,
    COUNT(DISTINCT q.store_id) as lojas_afetadas,
    MAX(q.created_at) as ultima_ocorrencia
FROM sistemaretiradas.whatsapp_message_queue q
WHERE q.status = 'FAILED'
AND q.error_message IS NOT NULL
AND q.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY LEFT(q.error_message, 100)
ORDER BY ocorrencias DESC
LIMIT 20;

-- 8. MENSAGENS QUE FALHARAM MAS AINDA PODEM SER REPROCESSADAS
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.error_message,
    q.retry_count,
    q.max_retries,
    q.created_at,
    q.updated_at,
    s.name as store_name,
    CASE 
        WHEN q.retry_count < q.max_retries THEN '✅ PODE SER REPROCESSADA'
        ELSE '❌ LIMITE DE TENTATIVAS ATINGIDO'
    END as pode_reprocessar
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'FAILED'
AND q.retry_count < q.max_retries
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 20;

-- 9. TIMELINE DE MENSAGENS (ÚLTIMAS 24H) - ÚLTIMAS 20
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.message_type,
    s.name as store_name,
    q.created_at,
    q.sent_at,
    q.error_message,
    CASE 
        WHEN q.sent_at IS NOT NULL THEN 
            ROUND(EXTRACT(EPOCH FROM (q.sent_at - q.created_at)), 2)
        ELSE NULL
    END as tempo_processamento_segundos
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 20;

-- 10. VERIFICAR SE HÁ MENSAGENS TRAVADAS EM "SENDING" (MAIS DE 5 MINUTOS)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.updated_at,
    s.name as store_name,
    EXTRACT(EPOCH FROM (NOW() - q.updated_at)) / 60 as minutos_travado,
    '⚠️ MENSAGEM TRAVADA - CONSIDERAR RESETAR PARA PENDING' as acao_sugerida
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SENDING'
AND q.updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY q.updated_at ASC;

-- 11. VERIFICAR RESPOSTAS DO N8N SALVAS NO METADATA (ÚLTIMAS 24H)
-- ============================================================================
-- Esta query mostra o que o N8N realmente retornou para cada mensagem
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.sent_at,
    s.name as store_name,
    q.metadata->>'n8n_response_received_at' as n8n_response_time,
    q.metadata->'n8n_response' as n8n_response_full,
    q.metadata->'n8n_response'->>'success' as n8n_success,
    q.metadata->'n8n_response'->>'error' as n8n_error,
    q.metadata->'n8n_response'->>'message' as n8n_message,
    q.metadata->'n8n_response'->>'status' as n8n_status,
    CASE 
        WHEN q.metadata->'n8n_response'->>'success' = 'false' THEN '❌ N8N RETORNOU FALHA'
        WHEN q.metadata->'n8n_response'->>'error' IS NOT NULL THEN '❌ N8N RETORNOU ERRO'
        WHEN q.metadata->'n8n_response'->>'status' IN ('error', 'failed') THEN '❌ N8N STATUS DE ERRO'
        WHEN q.status = 'SENT' AND q.metadata->'n8n_response' IS NULL THEN '⚠️ SEM RESPOSTA DO N8N SALVA'
        WHEN q.status = 'SENT' THEN '✅ RESPOSTA DO N8N SALVA'
        ELSE '❓ STATUS DESCONHECIDO'
    END as validacao_resposta
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.created_at >= NOW() - INTERVAL '24 hours'
AND q.status = 'SENT'
ORDER BY q.sent_at DESC
LIMIT 50;

