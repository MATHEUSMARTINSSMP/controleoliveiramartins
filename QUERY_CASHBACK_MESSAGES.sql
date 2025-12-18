-- ============================================================================
-- QUERY: Mensagens WhatsApp de Cashback EARNED
-- ============================================================================

-- OPÇÃO 1: Apenas mensagens já ENVIADAS (com registro na tabela whatsapp_messages)
-- ============================================================================
SELECT 
  wm.message_id,
  wm.phone_number AS telefone,
  wm.message_text AS mensagem,
  wm.timestamp AS data_envio,
  wm.site_slug AS loja,
  wm.status
FROM sistemaretiradas.whatsapp_messages wm
WHERE 
  (wm.message_text ILIKE '%Cashback Gerado%' OR wm.message_text ILIKE '%cashback%')
  AND wm.direction = 'outbound'
ORDER BY wm.timestamp DESC;

-- ============================================================================
-- OPÇÃO 2: Fila de cashback - TODAS (incluindo pendentes e enviadas)
-- ============================================================================
SELECT 
  -- Transação de Cashback
  ct.id AS transaction_id,
  ct.amount AS valor_cashback,
  ct.created_at AS data_transacao,
  ct.data_expiracao,
  
  -- Cliente
  cwq.cliente_nome,
  cwq.cliente_telefone,
  cwq.status AS status_fila,
  cwq.attempts AS tentativas,
  cwq.error_message AS erro,
  cwq.created_at AS data_criacao_fila,
  
  -- Mensagem WhatsApp (se já foi enviada)
  wm.message_id,
  wm.message_text AS mensagem_enviada,
  wm.timestamp AS data_envio_mensagem

FROM sistemaretiradas.cashback_whatsapp_queue cwq

-- Transação de cashback EARNED
INNER JOIN sistemaretiradas.cashback_transactions ct 
  ON ct.id = cwq.transaction_id
  AND ct.transaction_type = 'EARNED'

-- Mensagem WhatsApp (se existe)
LEFT JOIN sistemaretiradas.whatsapp_messages wm 
  ON wm.phone_number = cwq.cliente_telefone
  AND wm.direction = 'outbound'
  AND (wm.message_text ILIKE '%Cashback%' OR wm.message_text ILIKE '%cashback%')
  AND wm.timestamp BETWEEN cwq.created_at - INTERVAL '1 hour' 
                      AND cwq.created_at + INTERVAL '24 hours'

ORDER BY cwq.created_at DESC;

-- ============================================================================
-- OPÇÃO 3: Apenas mensagens JÁ ENVIADAS (com join completo)
-- ============================================================================
SELECT 
  -- Mensagem WhatsApp
  wm.message_id,
  wm.phone_number AS telefone,
  wm.message_text AS mensagem,
  wm.timestamp AS data_envio_mensagem,
  wm.site_slug AS loja_slug,
  
  -- Transação de Cashback
  ct.id AS transaction_id,
  ct.amount AS valor_cashback,
  ct.created_at AS data_transacao,
  ct.data_expiracao,
  
  -- Cliente
  cwq.cliente_nome,
  cwq.cliente_telefone,
  cwq.status AS status_fila

FROM sistemaretiradas.whatsapp_messages wm

-- Relacionar com fila de cashback
INNER JOIN sistemaretiradas.cashback_whatsapp_queue cwq 
  ON wm.phone_number = cwq.cliente_telefone
  AND wm.direction = 'outbound'
  AND (wm.message_text ILIKE '%Cashback%' OR wm.message_text ILIKE '%cashback%')
  AND wm.timestamp BETWEEN cwq.created_at - INTERVAL '1 hour' 
                      AND cwq.created_at + INTERVAL '24 hours'

-- Transação de cashback EARNED
INNER JOIN sistemaretiradas.cashback_transactions ct 
  ON ct.id = cwq.transaction_id
  AND ct.transaction_type = 'EARNED'

ORDER BY wm.timestamp DESC;
