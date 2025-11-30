-- ============================================================================
-- VERIFICAR NÚMEROS PARA ONDE FORAM ENVIADAS AS MENSAGENS
-- ============================================================================
-- Este script mostra exatamente para quais números foram enviadas as mensagens
-- de cashback, incluindo o número original e o normalizado (DDI + DDD + número)
-- ============================================================================

-- ============================================================================
-- 1. MENSAGENS ENVIADAS COM NÚMEROS (DETALHADO)
-- ============================================================================
-- Mostra todas as mensagens enviadas com sucesso, incluindo número original
-- e número normalizado que foi usado no envio

SELECT 
    q.id as fila_id,
    q.status,
    q.created_at as criado_em,
    q.last_attempt_at as enviado_em,
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    -- Normalizar telefone para formato WhatsApp (DDI + DDD + número)
    CASE 
        WHEN c.telefone IS NULL OR c.telefone = '' THEN NULL
        ELSE
            -- Remove caracteres não numéricos
            REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
    END as telefone_somente_numeros,
    -- Função para normalizar telefone (mesma lógica do código)
    CASE 
        WHEN c.telefone IS NULL OR c.telefone = '' THEN NULL
        ELSE
            (
                WITH cleaned AS (
                    -- Remove caracteres não numéricos
                    SELECT REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') as digits
                ),
                no_zero AS (
                    -- Remove zero inicial se houver
                    SELECT CASE 
                        WHEN digits LIKE '0%' THEN SUBSTRING(digits, 2)
                        ELSE digits
                    END as digits_no_zero
                    FROM cleaned
                ),
                no_ddi AS (
                    -- Remove DDI 55 se já tiver e for muito longo
                    SELECT CASE 
                        WHEN digits_no_zero LIKE '55%' AND LENGTH(digits_no_zero) > 12 
                        THEN SUBSTRING(digits_no_zero, 3)
                        ELSE digits_no_zero
                    END as digits_final
                    FROM no_zero
                )
                -- Adiciona DDI 55 se não tiver
                SELECT CASE 
                    WHEN digits_final LIKE '55%' THEN digits_final
                    ELSE '55' || digits_final
                END
                FROM no_ddi
            )
    END as telefone_normalizado_whatsapp,
    s.name as loja_nome,
    ct.amount as valor_cashback,
    ct.data_expiracao as cashback_expira_em
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC;

-- ============================================================================
-- 2. RESUMO POR NÚMERO (quantas mensagens foram enviadas para cada número)
-- ============================================================================

SELECT 
    c.telefone as telefone_original,
    -- Número normalizado (formato WhatsApp)
    (
        WITH cleaned AS (
            SELECT REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') as digits
        ),
        no_zero AS (
            SELECT CASE 
                WHEN digits LIKE '0%' THEN SUBSTRING(digits, 2)
                ELSE digits
            END as digits_no_zero
            FROM cleaned
        ),
        no_ddi AS (
            SELECT CASE 
                WHEN digits_no_zero LIKE '55%' AND LENGTH(digits_no_zero) > 12 
                THEN SUBSTRING(digits_no_zero, 3)
                ELSE digits_no_zero
            END as digits_final
            FROM no_zero
        )
        SELECT CASE 
            WHEN digits_final LIKE '55%' THEN digits_final
            ELSE '55' || digits_final
        END
        FROM no_ddi
    ) as telefone_normalizado,
    COUNT(*) as total_mensagens_enviadas,
    MIN(q.created_at) as primeira_mensagem,
    MAX(q.last_attempt_at) as ultima_mensagem,
    c.nome as cliente_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
  AND c.telefone IS NOT NULL 
  AND c.telefone != ''
GROUP BY c.telefone, c.nome
ORDER BY total_mensagens_enviadas DESC, ultima_mensagem DESC;

-- ============================================================================
-- 3. ÚLTIMAS 50 MENSAGENS ENVIADAS (COM NÚMEROS)
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.last_attempt_at as enviado_em,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    (
        WITH cleaned AS (
            SELECT REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') as digits
        ),
        no_zero AS (
            SELECT CASE 
                WHEN digits LIKE '0%' THEN SUBSTRING(digits, 2)
                ELSE digits
            END as digits_no_zero
            FROM cleaned
        ),
        no_ddi AS (
            SELECT CASE 
                WHEN digits_no_zero LIKE '55%' AND LENGTH(digits_no_zero) > 12 
                THEN SUBSTRING(digits_no_zero, 3)
                ELSE digits_no_zero
            END as digits_final
            FROM no_zero
        )
        SELECT CASE 
            WHEN digits_final LIKE '55%' THEN digits_final
            ELSE '55' || digits_final
        END
        FROM no_ddi
    ) as telefone_normalizado_whatsapp,
    s.name as loja,
    ct.amount as valor_cashback
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
LEFT JOIN sistemaretiradas.cashback_transactions ct ON ct.id = q.transaction_id
WHERE q.status = 'SENT'
  AND c.telefone IS NOT NULL 
  AND c.telefone != ''
ORDER BY q.last_attempt_at DESC
LIMIT 50;

-- ============================================================================
-- 4. MENSAGENS PULADAS (SEM TELEFONE)
-- ============================================================================

SELECT 
    q.id as fila_id,
    q.created_at as criado_em,
    q.error_message as motivo,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    s.name as loja_nome
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = q.store_id
WHERE q.status = 'SKIPPED'
ORDER BY q.created_at DESC;

-- ============================================================================
-- 5. LISTA SIMPLES DE TODOS OS NÚMEROS QUE RECEBERAM MENSAGENS
-- ============================================================================

SELECT DISTINCT
    (
        WITH cleaned AS (
            SELECT REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') as digits
        ),
        no_zero AS (
            SELECT CASE 
                WHEN digits LIKE '0%' THEN SUBSTRING(digits, 2)
                ELSE digits
            END as digits_no_zero
            FROM cleaned
        ),
        no_ddi AS (
            SELECT CASE 
                WHEN digits_no_zero LIKE '55%' AND LENGTH(digits_no_zero) > 12 
                THEN SUBSTRING(digits_no_zero, 3)
                ELSE digits_no_zero
            END as digits_final
            FROM no_zero
        )
        SELECT CASE 
            WHEN digits_final LIKE '55%' THEN digits_final
            ELSE '55' || digits_final
        END
        FROM no_ddi
    ) as telefone_normalizado_whatsapp,
    c.nome as cliente_nome,
    COUNT(*) as total_envios
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
  AND c.telefone IS NOT NULL 
  AND c.telefone != ''
GROUP BY c.telefone, c.nome
ORDER BY total_envios DESC;

