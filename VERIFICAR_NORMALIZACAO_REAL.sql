-- ============================================================================
-- VERIFICAR COMO OS NÚMEROS SERÃO NORMALIZADOS
-- ============================================================================
-- Esta query simula a normalização que será feita pelo código
-- para verificar se os números estão sendo formatados corretamente
-- ============================================================================

SELECT 
    c.nome as cliente_nome,
    c.telefone as telefone_original,
    -- Passo 1: Remover caracteres não numéricos
    REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') as passo1_somente_numeros,
    -- Passo 2: Remover zero inicial se houver
    CASE 
        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
    END as passo2_sem_zero_inicial,
    -- Passo 3: Remover DDI 55 se já tiver e for muito longo
    CASE 
        WHEN (
            CASE 
                WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
            END
        ) LIKE '55%' 
        AND LENGTH(
            CASE 
                WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
            END
        ) > 12
        THEN SUBSTRING(
            CASE 
                WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
            END,
            3
        )
        ELSE (
            CASE 
                WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
            END
        )
    END as passo3_sem_ddi_duplicado,
    -- Passo 4: Adicionar DDI 55 se não tiver
    CASE 
        WHEN (
            CASE 
                WHEN (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) LIKE '55%' 
                AND LENGTH(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) > 12
                THEN SUBSTRING(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END,
                    3
                )
                ELSE (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                )
            END
        ) LIKE '55%'
        THEN (
            CASE 
                WHEN (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) LIKE '55%' 
                AND LENGTH(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) > 12
                THEN SUBSTRING(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END,
                    3
                )
                ELSE (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                )
            END
        )
        ELSE '55' || (
            CASE 
                WHEN (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) LIKE '55%' 
                AND LENGTH(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                ) > 12
                THEN SUBSTRING(
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END,
                    3
                )
                ELSE (
                    CASE 
                        WHEN REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g') LIKE '0%'
                        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 2)
                        ELSE REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g')
                    END
                )
            END
        )
    END as telefone_normalizado_final,
    q.status,
    q.last_attempt_at as enviado_em
FROM sistemaretiradas.cashback_whatsapp_queue q
LEFT JOIN sistemaretiradas.tiny_contacts c ON c.id = q.cliente_id
WHERE q.status = 'SENT'
ORDER BY q.last_attempt_at DESC;

