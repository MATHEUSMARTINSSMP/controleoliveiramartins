-- ============================================================================
-- VERIFICAR CONFIGURAÇÃO DE NOTIFICAÇÕES - LOJA LOUNGERIE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Verificar se há configurações de notificações de VENDA para a Loungerie
-- e comparar com CONTROLE_PONTO (que está funcionando)
-- ============================================================================

-- 1. VERIFICAR ID DA LOJA LOUNGERIE
-- ============================================================================
SELECT 
    id,
    name,
    admin_id,
    whatsapp_ativo,
    whatsapp_connection_status
FROM sistemaretiradas.stores
WHERE LOWER(name) LIKE '%loungerie%'
   OR LOWER(name) LIKE '%loung%'
LIMIT 1;

-- 2. VERIFICAR CONFIGURAÇÕES DE NOTIFICAÇÃO DE VENDA PARA LOUNGERIE
-- ============================================================================
SELECT 
    wnc.id,
    wnc.admin_id,
    wnc.store_id,
    wnc.phone,
    wnc.notification_type,
    wnc.active,
    wnc.created_at,
    wnc.updated_at,
    s.name as store_name,
    CASE 
        WHEN wnc.store_id IS NULL THEN 'GLOBAL (todas as lojas)'
        ELSE 'ESPECÍFICA DA LOJA'
    END as escopo
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
WHERE wnc.notification_type = 'VENDA'
AND (
    wnc.store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
    OR wnc.store_id IS NULL -- Configurações globais
)
AND wnc.admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
ORDER BY 
    CASE WHEN wnc.store_id IS NULL THEN 1 ELSE 0 END, -- Globais primeiro
    wnc.active DESC,
    wnc.created_at DESC;

-- 3. VERIFICAR CONFIGURAÇÕES DE NOTIFICAÇÃO DE CONTROLE_PONTO (PARA COMPARAR)
-- ============================================================================
SELECT 
    wnc.id,
    wnc.admin_id,
    wnc.store_id,
    wnc.phone,
    wnc.notification_type,
    wnc.active,
    wnc.created_at,
    wnc.updated_at,
    s.name as store_name,
    CASE 
        WHEN wnc.store_id IS NULL THEN 'GLOBAL (todas as lojas)'
        ELSE 'ESPECÍFICA DA LOJA'
    END as escopo
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
WHERE wnc.notification_type = 'CONTROLE_PONTO'
AND (
    wnc.store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
    OR wnc.store_id IS NULL -- Configurações globais
)
AND wnc.admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
ORDER BY 
    CASE WHEN wnc.store_id IS NULL THEN 1 ELSE 0 END, -- Globais primeiro
    wnc.active DESC,
    wnc.created_at DESC;

-- 4. COMPARAR: VENDA vs CONTROLE_PONTO
-- ============================================================================
SELECT 
    'VENDA' as tipo,
    COUNT(*) FILTER (WHERE active = true) as ativas,
    COUNT(*) FILTER (WHERE active = false) as inativas,
    COUNT(*) FILTER (WHERE store_id IS NULL) as globais,
    COUNT(*) FILTER (WHERE store_id IS NOT NULL) as especificas_loja,
    COUNT(DISTINCT phone) as telefones_unicos
FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'VENDA'
AND admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
AND (
    store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
    OR store_id IS NULL
)

UNION ALL

SELECT 
    'CONTROLE_PONTO' as tipo,
    COUNT(*) FILTER (WHERE active = true) as ativas,
    COUNT(*) FILTER (WHERE active = false) as inativas,
    COUNT(*) FILTER (WHERE store_id IS NULL) as globais,
    COUNT(*) FILTER (WHERE store_id IS NOT NULL) as especificas_loja,
    COUNT(DISTINCT phone) as telefones_unicos
FROM sistemaretiradas.whatsapp_notification_config
WHERE notification_type = 'CONTROLE_PONTO'
AND admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
AND (
    store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
    OR store_id IS NULL
);

-- 5. VERIFICAR MENSAGENS DE VENDA NA FILA PARA LOUNGERIE (ÚLTIMAS 24H)
-- ============================================================================
SELECT 
    q.id,
    q.phone,
    q.status,
    q.created_at,
    q.sent_at,
    q.error_message,
    q.retry_count,
    q.metadata->>'notification_type' as notification_type,
    q.metadata->>'source' as source,
    q.metadata->>'colaboradora' as colaboradora,
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
WHERE q.store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
AND q.metadata->>'notification_type' = 'VENDA'
AND q.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY q.created_at DESC
LIMIT 20;

-- 6. VERIFICAR SE HÁ DESTINATÁRIOS ATIVOS PARA VENDA (SIMULANDO O QUE O CÓDIGO FAZ)
-- ============================================================================
-- Esta query simula exatamente o que o LojaDashboard faz ao buscar destinatários
SELECT 
    wnc.phone,
    wnc.notification_type,
    wnc.active,
    wnc.store_id,
    s.name as store_name,
    CASE 
        WHEN wnc.store_id IS NULL THEN 'GLOBAL'
        WHEN wnc.store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1) THEN 'LOUNGERIE'
        ELSE 'OUTRA LOJA'
    END as tipo_config
FROM sistemaretiradas.whatsapp_notification_config wnc
LEFT JOIN sistemaretiradas.stores s ON s.id = wnc.store_id
WHERE wnc.admin_id = (SELECT admin_id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
AND wnc.notification_type = 'VENDA'
AND wnc.active = true
AND (
    wnc.store_id = (SELECT id FROM sistemaretiradas.stores WHERE LOWER(name) LIKE '%loungerie%' OR LOWER(name) LIKE '%loung%' LIMIT 1)
    OR wnc.store_id IS NULL
)
ORDER BY 
    CASE WHEN wnc.store_id IS NULL THEN 1 ELSE 0 END; -- Globais primeiro

