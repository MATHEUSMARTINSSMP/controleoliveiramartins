-- ============================================================================
-- SIMULAR NORMALIZAÇÃO DOS NÚMEROS ENVIADOS
-- ============================================================================
-- Esta query simula como os números serão normalizados pelo código
-- ============================================================================

SELECT 
    q.id as fila_id,
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    q.status,
    q.last_attempt_at as enviado_em,
    -- Simulação da normalização (simplificada)
    '55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    ) as telefone_como_deve_ser_enviado,
    LENGTH('55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    )) as tamanho_numero_normalizado
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC;

-- ============================================================================
-- VERIFICAR TODOS OS NÚMEROS QUE FORAM ENVIADOS (RESUMO)
-- ============================================================================

SELECT 
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    -- Número que será enviado (simulação)
    '55' || REGEXP_REPLACE(
        CASE 
            WHEN c.telefone LIKE '0%' THEN SUBSTRING(REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g'), 2)
            ELSE REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
        END,
        '^55',
        ''
    ) as numero_que_foi_enviado,
    COUNT(q.id) as total_envios,
    MAX(q.last_attempt_at) as ultimo_envio
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
  AND c.telefone IS NOT NULL
GROUP BY c.nome, c.telefone
ORDER BY ultimo_envio DESC;

