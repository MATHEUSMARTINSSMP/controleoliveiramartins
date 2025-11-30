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
-- 2. CHAMAR A FUNÇÃO NETLIFY VIA HTTP (Usando pg_net ou http extension)
-- ============================================================================

-- Opção 1: Usar pg_net (se disponível)
SELECT 
    net.http_post(
        url := 'https://eleveaone.com.br/.netlify/functions/process-cashback-whatsapp-queue',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    ) as request_id;

-- ============================================================================
-- 3. VER RESULTADO APÓS PROCESSAR (Execute novamente a Query 1)
-- ============================================================================

-- Execute a Query 1 novamente para ver quais mensagens foram processadas

-- ============================================================================
-- NOTA: Para processar via SQL direto, você precisa chamar a Netlify Function
-- Ou usar um script Node.js/Python para chamar a função
-- ============================================================================

