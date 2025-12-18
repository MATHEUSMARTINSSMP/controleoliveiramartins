-- ============================================================================
-- REPROCESSAR: Transações que DEVERIAM estar na fila mas não estão
-- ============================================================================
-- Esta query identifica e reprocessa transações EARNED que:
-- - Têm cliente_id
-- - Cliente tem telefone
-- - Loja tem WhatsApp e Cashback ativos
-- Mas não estão na fila
-- ============================================================================

-- ============================================================================
-- OPÇÃO 1: Listar as transações que deveriam estar na fila
-- ============================================================================
SELECT 
    ct.id AS transaction_id,
    ct.amount AS valor_cashback,
    ct.created_at,
    COALESCE(crm.nome, tiny.nome) AS cliente_nome,
    COALESCE(crm.telefone, tiny.telefone) AS cliente_telefone,
    COALESCE(ct.store_id, crm.store_id, tiny.store_id) AS store_id,
    s.name AS loja_nome
FROM sistemaretiradas.cashback_transactions ct
LEFT JOIN sistemaretiradas.crm_contacts crm ON crm.id = ct.cliente_id
LEFT JOIN sistemaretiradas.tiny_contacts tiny ON tiny.id = ct.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = COALESCE(ct.store_id, crm.store_id, tiny.store_id)
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND ct.cliente_id IS NOT NULL
    AND COALESCE(crm.telefone, tiny.telefone) IS NOT NULL
    AND COALESCE(crm.telefone, tiny.telefone) != ''
    AND COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NOT NULL
    AND s.whatsapp_ativo IS TRUE
    AND s.cashback_ativo IS TRUE
    AND NOT EXISTS (
        SELECT 1 
        FROM sistemaretiradas.cashback_whatsapp_queue cwq
        WHERE cwq.transaction_id = ct.id
    )
ORDER BY ct.created_at DESC;

-- ============================================================================
-- OPÇÃO 2: Reprocessar automaticamente (usando a função de reprocessamento)
-- ============================================================================
SELECT * FROM sistemaretiradas.reprocessar_cashback_fila(7, 100);

-- ============================================================================
-- OPÇÃO 3: Reprocessar manualmente uma transação específica
-- ============================================================================
-- Descomente e substitua os UUIDs pelos valores reais
/*
DO $$
DECLARE
    v_transaction_id UUID := '7246a7a0-645c-46da-8f09-44cf5b361491'; -- Exemplo
    v_cliente_id UUID;
    v_store_id UUID;
    v_resultado TEXT;
BEGIN
    -- Buscar dados da transação
    SELECT cliente_id, store_id INTO v_cliente_id, v_store_id
    FROM sistemaretiradas.cashback_transactions
    WHERE id = v_transaction_id;
    
    -- Se store_id for NULL, buscar do cliente
    IF v_store_id IS NULL THEN
        SELECT store_id INTO v_store_id
        FROM sistemaretiradas.crm_contacts
        WHERE id = v_cliente_id;
        
        IF v_store_id IS NULL THEN
            SELECT store_id INTO v_store_id
            FROM sistemaretiradas.tiny_contacts
            WHERE id = v_cliente_id;
        END IF;
    END IF;
    
    -- Tentar enfileirar
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_transaction_id,
            v_cliente_id,
            v_store_id
        );
        v_resultado := '✅ Adicionado à fila com sucesso';
    EXCEPTION WHEN OTHERS THEN
        v_resultado := '❌ Erro: ' || SQLERRM;
    END;
    
    RAISE NOTICE 'Transação %: %', v_transaction_id, v_resultado;
END $$;
*/

-- ============================================================================
-- OPÇÃO 4: Reprocessar TODAS as 50 transações automaticamente
-- ============================================================================
DO $$
DECLARE
    v_transaction RECORD;
    v_count_success INTEGER := 0;
    v_count_error INTEGER := 0;
    v_count_skipped INTEGER := 0;
    v_store_id UUID;
BEGIN
    FOR v_transaction IN
        SELECT 
            ct.id AS transaction_id,
            ct.cliente_id,
            COALESCE(ct.store_id, crm.store_id, tiny.store_id) AS store_id_final,
            COALESCE(crm.nome, tiny.nome) AS cliente_nome
        FROM sistemaretiradas.cashback_transactions ct
        LEFT JOIN sistemaretiradas.crm_contacts crm ON crm.id = ct.cliente_id
        LEFT JOIN sistemaretiradas.tiny_contacts tiny ON tiny.id = ct.cliente_id
        LEFT JOIN sistemaretiradas.stores s ON s.id = COALESCE(ct.store_id, crm.store_id, tiny.store_id)
        WHERE ct.transaction_type = 'EARNED'
            AND ct.created_at >= CURRENT_DATE - INTERVAL '7 days'
            AND ct.cliente_id IS NOT NULL
            AND COALESCE(crm.telefone, tiny.telefone) IS NOT NULL
            AND COALESCE(crm.telefone, tiny.telefone) != ''
            AND COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NOT NULL
            AND s.whatsapp_ativo IS TRUE
            AND s.cashback_ativo IS TRUE
            AND NOT EXISTS (
                SELECT 1 
                FROM sistemaretiradas.cashback_whatsapp_queue cwq
                WHERE cwq.transaction_id = ct.id
            )
        ORDER BY ct.created_at DESC
        LIMIT 100
    LOOP
        BEGIN
            PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
                v_transaction.transaction_id,
                v_transaction.cliente_id,
                v_transaction.store_id_final
            );
            v_count_success := v_count_success + 1;
            RAISE NOTICE '✅ [%] Adicionado à fila: % (%)', v_count_success, v_transaction.transaction_id, v_transaction.cliente_nome;
        EXCEPTION WHEN OTHERS THEN
            v_count_error := v_count_error + 1;
            RAISE WARNING '❌ [%] Erro ao adicionar %: %', v_count_error, v_transaction.transaction_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RESUMO DO REPROCESSAMENTO';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ Sucessos: %', v_count_success;
    RAISE NOTICE '❌ Erros: %', v_count_error;
    RAISE NOTICE '============================================================';
END $$;

