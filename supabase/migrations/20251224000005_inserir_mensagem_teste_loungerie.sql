-- ============================================================================
-- INSERIR MENSAGEM DE TESTE NA FILA - LOJA LOUNGERIE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Inserir mensagem de teste na fila para verificar se está funcionando
-- ============================================================================

-- 1. VERIFICAR ID DA LOJA LOUNGERIE
-- ============================================================================
SELECT 
    id,
    name,
    admin_id
FROM sistemaretiradas.stores
WHERE LOWER(name) LIKE '%loungerie%'
   OR LOWER(name) LIKE '%loung%'
LIMIT 1;

-- 2. INSERIR MENSAGEM DE TESTE NA FILA
-- ============================================================================
-- Substitua 'LOUNGERIE_STORE_ID' pelo ID retornado na query acima
-- Substitua 'TELEFONE_TESTE' por um dos números configurados (ex: 96981032928)
INSERT INTO sistemaretiradas.whatsapp_message_queue (
    phone,
    message,
    store_id,
    priority,
    message_type,
    status,
    metadata
) VALUES (
    '96981032928', -- Telefone de teste (um dos números configurados)
    '🧪 *MENSAGEM DE TESTE - LOUNGERIE*

Esta é uma mensagem de teste para verificar se o sistema de WhatsApp está funcionando corretamente para a loja Loungerie.

*Data/Hora:* ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI:SS') || '

Se você recebeu esta mensagem, o sistema está funcionando! ✅

Sistema EleveaOne 📊',
    (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1), -- ID da loja Loungerie
    1, -- Prioridade crítica
    'NOTIFICATION', -- Tipo: NOTIFICATION
    'PENDING', -- Status: PENDING (será processada pela fila)
    jsonb_build_object(
        'source', 'teste_manual',
        'notification_type', 'TESTE',
        'teste', true,
        'created_by', 'admin',
        'teste_timestamp', NOW()::text
    )
)
RETURNING 
    id,
    phone,
    LEFT(message, 100) as message_preview,
    store_id,
    status,
    priority,
    message_type,
    created_at,
    metadata;

-- 3. VERIFICAR SE A MENSAGEM FOI INSERIDA
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.priority,
    q.message_type,
    q.created_at,
    s.name as store_name,
    q.metadata
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.metadata->>'teste' = 'true'
AND q.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY q.created_at DESC
LIMIT 5;

-- 4. VERIFICAR STATUS DA MENSAGEM APÓS PROCESSAMENTO (EXECUTAR DEPOIS DE ALGUNS SEGUNDOS)
-- ============================================================================
-- Execute esta query após alguns segundos para ver se a mensagem foi processada
SELECT 
    q.id,
    q.phone,
    q.status,
    q.sent_at,
    q.error_message,
    q.retry_count,
    q.metadata->'n8n_response' as n8n_response,
    q.metadata->'n8n_response'->>'success' as n8n_success,
    q.metadata->'n8n_response'->>'error' as n8n_error,
    s.name as store_name,
    CASE 
        WHEN q.status = 'SENT' AND q.metadata->'n8n_response'->>'success' = 'true' THEN '✅ ENVIADA COM SUCESSO'
        WHEN q.status = 'SENT' AND q.metadata->'n8n_response' IS NULL THEN '⚠️ MARCADA COMO SENT MAS SEM RESPOSTA N8N'
        WHEN q.status = 'FAILED' THEN '❌ FALHOU: ' || COALESCE(q.error_message, 'Sem erro')
        WHEN q.status = 'PENDING' THEN '⏳ AINDA PENDENTE'
        WHEN q.status = 'SENDING' THEN '📤 SENDO ENVIADA'
        ELSE '❓ STATUS: ' || q.status
    END as status_detalhado
FROM sistemaretiradas.whatsapp_message_queue q
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.metadata->>'teste' = 'true'
ORDER BY q.created_at DESC
LIMIT 1;

