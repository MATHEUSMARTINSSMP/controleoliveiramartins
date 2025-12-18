-- ============================================================================
-- TESTE: Verificar Status da Fila de Envio de Mensagens de Cashback
-- ============================================================================
-- Este script verifica se as mensagens de cashback estão sendo:
-- 1. Criadas na fila quando uma compra é feita
-- 2. Processadas e enviadas corretamente
-- 3. Relacionadas corretamente com as transações e clientes
-- ============================================================================

-- ============================================================================
-- VISÃO GERAL: Resumo da Fila
-- ============================================================================
SELECT 
    status,
    COUNT(*) AS quantidade,
    MIN(created_at) AS primeira_criacao,
    MAX(created_at) AS ultima_criacao
FROM sistemaretiradas.cashback_whatsapp_queue
GROUP BY status
ORDER BY 
    CASE status
        WHEN 'PENDING' THEN 1
        WHEN 'PROCESSING' THEN 2
        WHEN 'SENT' THEN 3
        WHEN 'FAILED' THEN 4
        WHEN 'SKIPPED' THEN 5
        ELSE 6
    END;

-- ============================================================================
-- DETALHES COMPLETOS: Fila com Informações da Transação e Cliente
-- ============================================================================
SELECT 
    -- ID e Status da Fila
    cwq.id AS fila_id,
    cwq.status AS status_fila,
    cwq.attempts AS tentativas,
    cwq.error_message AS erro,
    cwq.created_at AS criado_em,
    cwq.updated_at AS atualizado_em,
    
    -- Informações da Transação
    ct.id AS transaction_id,
    ct.amount AS valor_cashback,
    ct.transaction_type AS tipo_transacao,
    ct.created_at AS transacao_criada_em,
    ct.data_expiracao AS expira_em,
    
    -- Informações do Cliente
    cwq.cliente_nome,
    cwq.cliente_telefone,
    
    -- Informações da Loja
    cwq.store_id,
    s.name AS loja_nome,
    
    -- Informações da Compra (se disponível)
    ct.sale_id AS sale_id,
    
    -- Mensagem WhatsApp Enviada (se existe)
    wm.message_id AS whatsapp_message_id,
    wm.message_text AS mensagem_enviada,
    wm.timestamp AS mensagem_enviada_em,
    wm.status AS mensagem_status

FROM sistemaretiradas.cashback_whatsapp_queue cwq

-- Transação de Cashback
LEFT JOIN sistemaretiradas.cashback_transactions ct 
    ON ct.id = cwq.transaction_id

-- Loja
LEFT JOIN sistemaretiradas.stores s
    ON s.id = cwq.store_id

-- Mensagem WhatsApp (se foi enviada)
LEFT JOIN sistemaretiradas.whatsapp_messages wm 
    ON wm.phone_number = cwq.cliente_telefone
    AND wm.direction = 'outbound'
    AND (wm.message_text ILIKE '%Cashback%' OR wm.message_text ILIKE '%cashback%')
    AND wm.timestamp BETWEEN cwq.created_at - INTERVAL '1 hour' 
                        AND cwq.created_at + INTERVAL '24 hours'

ORDER BY cwq.created_at DESC
LIMIT 50;

-- ============================================================================
-- PENDENTES: Itens na Fila Aguardando Envio
-- ============================================================================
SELECT 
    cwq.id AS fila_id,
    cwq.status,
    cwq.cliente_nome,
    cwq.cliente_telefone,
    ct.amount AS valor_cashback,
    cwq.created_at AS criado_em,
    s.name AS loja_nome,
    CASE 
        WHEN cwq.cliente_telefone IS NULL OR cwq.cliente_telefone = '' THEN '❌ Sem telefone'
        WHEN cwq.store_id IS NULL THEN '❌ Sem loja'
        ELSE '✅ OK'
    END AS validacao
FROM sistemaretiradas.cashback_whatsapp_queue cwq
LEFT JOIN sistemaretiradas.cashback_transactions ct 
    ON ct.id = cwq.transaction_id
LEFT JOIN sistemaretiradas.stores s
    ON s.id = cwq.store_id
WHERE cwq.status IN ('PENDING', 'PROCESSING')
ORDER BY cwq.created_at ASC;

-- ============================================================================
-- FALHAS: Itens que Falharam no Envio
-- ============================================================================
SELECT 
    cwq.id AS fila_id,
    cwq.status,
    cwq.attempts AS tentativas,
    cwq.error_message AS erro,
    cwq.cliente_nome,
    cwq.cliente_telefone,
    ct.amount AS valor_cashback,
    cwq.created_at AS criado_em,
    s.name AS loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue cwq
LEFT JOIN sistemaretiradas.cashback_transactions ct 
    ON ct.id = cwq.transaction_id
LEFT JOIN sistemaretiradas.stores s
    ON s.id = cwq.store_id
WHERE cwq.status = 'FAILED'
ORDER BY cwq.updated_at DESC
LIMIT 20;

-- ============================================================================
-- VERIFICAÇÃO: Transações EARNED Sem Item na Fila
-- ============================================================================
-- Esta query identifica transações de cashback EARNED que NÃO têm
-- um item correspondente na fila de WhatsApp (pode indicar problema no trigger)
SELECT 
    ct.id AS transaction_id,
    ct.amount AS valor_cashback,
    ct.created_at AS transacao_criada_em,
    ct.sale_id,
    '⚠️ Transação sem item na fila' AS problema
FROM sistemaretiradas.cashback_transactions ct
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= NOW() - INTERVAL '7 days'  -- Últimos 7 dias
    AND NOT EXISTS (
        SELECT 1 
        FROM sistemaretiradas.cashback_whatsapp_queue cwq
        WHERE cwq.transaction_id = ct.id
    )
ORDER BY ct.created_at DESC;

-- ============================================================================
-- VERIFICAÇÃO: Compras Recentes com Cashback Mas Sem Fila
-- ============================================================================
-- Verifica se há compras recentes que geraram cashback mas não têm item na fila
SELECT 
    s.id AS sale_id,
    s.preco_final,
    s.data_compra,
    ct.id AS transaction_id,
    ct.amount AS cashback_gerado,
    ct.created_at AS cashback_criado_em,
    CASE 
        WHEN cwq.id IS NULL THEN '❌ Sem item na fila'
        ELSE '✅ Na fila'
    END AS status_fila
FROM sistemaretiradas.sales s
INNER JOIN sistemaretiradas.cashback_transactions ct
    ON ct.sale_id = s.id
    AND ct.transaction_type = 'EARNED'
LEFT JOIN sistemaretiradas.cashback_whatsapp_queue cwq
    ON cwq.transaction_id = ct.id
WHERE s.data_compra >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY s.data_compra DESC, s.id DESC
LIMIT 30;

-- ============================================================================
-- ESTATÍSTICAS: Performance de Envio (Últimos 30 dias)
-- ============================================================================
SELECT 
    DATE(cwq.created_at) AS data,
    COUNT(*) AS total_itens,
    COUNT(*) FILTER (WHERE cwq.status = 'SENT') AS enviados,
    COUNT(*) FILTER (WHERE cwq.status = 'PENDING') AS pendentes,
    COUNT(*) FILTER (WHERE cwq.status = 'PROCESSING') AS processando,
    COUNT(*) FILTER (WHERE cwq.status = 'FAILED') AS falhas,
    COUNT(*) FILTER (WHERE cwq.status = 'SKIPPED') AS ignorados,
    ROUND(
        COUNT(*) FILTER (WHERE cwq.status = 'SENT')::NUMERIC / 
        NULLIF(COUNT(*) FILTER (WHERE cwq.status != 'SKIPPED'), 0) * 100, 
        2
    ) AS taxa_sucesso_pct
FROM sistemaretiradas.cashback_whatsapp_queue cwq
WHERE cwq.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(cwq.created_at)
ORDER BY DATE(cwq.created_at) DESC;

