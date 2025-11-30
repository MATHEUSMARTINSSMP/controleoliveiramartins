-- ============================================================================
-- SCRIPT: Processar Fila de WhatsApp de Cashback AGORA
-- Descrição: SQL para processar manualmente a fila de WhatsApp
-- ============================================================================

-- ============================================================================
-- 1. VER MENSAGENS PENDENTES (Antes de processar)
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    NOW() - q.created_at as tempo_na_fila,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC;

-- ============================================================================
-- 2. VER MENSAGENS PENDENTES COM TEMPO NA FILA
-- ============================================================================

SELECT 
    q.id as queue_id,
    q.status,
    q.attempts as tentativas,
    q.created_at as criado_em,
    EXTRACT(EPOCH FROM (NOW() - q.created_at))::INTEGER as segundos_na_fila,
    CASE 
        WHEN NOW() - q.created_at > INTERVAL '10 minutes' THEN '🔴 CRÍTICO (>10min)'
        WHEN NOW() - q.created_at > INTERVAL '5 minutes' THEN '🟠 ATENÇÃO (>5min)'
        WHEN NOW() - q.created_at > INTERVAL '2 minutes' THEN '🟡 LONGO (>2min)'
        ELSE '🟢 NORMAL'
    END as prioridade,
    c.nome as cliente_nome,
    s.name as loja_nome,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON q.cliente_id = c.id
LEFT JOIN sistemaretiradas.stores s ON q.store_id = s.id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON q.transaction_id = ct.id
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC;

-- ============================================================================
-- 3. INSTRUÇÕES PARA PROCESSAR A FILA
-- ============================================================================

-- ⚠️ IMPORTANTE: Para processar a fila, você precisa usar uma das opções abaixo:

-- OPÇÃO 1: Usar cURL (Recomendado - Mais Simples)
-- Execute no terminal:
--   curl -X POST https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue

-- OPÇÃO 2: Usar Script Node.js
-- Execute no terminal:
--   export SUPABASE_SERVICE_ROLE_KEY="sua-chave-aqui"
--   node PROCESSAR_FILA_AGORA.js

-- OPÇÃO 3: Habilitar pg_net e usar SQL (Avançado)
-- 1. Habilitar extensão pg_net no Supabase Dashboard > Database > Extensions
-- 2. Depois execute:
--    SELECT net.http_post(
--        url := 'https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue',
--        headers := jsonb_build_object('Content-Type', 'application/json'),
--        body := '{}'::jsonb
--    ) as request_id;

-- ============================================================================
-- 4. VER RESULTADO APÓS PROCESSAR
-- ============================================================================

-- Execute a Query 1 ou Query 2 novamente para ver quais mensagens foram processadas

-- ============================================================================
-- 5. ESTATÍSTICAS RÁPIDAS
-- ============================================================================

SELECT 
    COUNT(*) as total_pendentes,
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '5 minutes' THEN 1 END) as pendentes_mais_5min,
    COUNT(CASE WHEN created_at < NOW() - INTERVAL '10 minutes' THEN 1 END) as pendentes_mais_10min,
    MIN(created_at) as mensagem_mais_antiga,
    EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INTEGER as segundos_da_mais_antiga
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE status = 'PENDING';

