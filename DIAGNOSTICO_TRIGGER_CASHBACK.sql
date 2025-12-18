-- ============================================================================
-- DIAGNÓSTICO: Por que o trigger não está criando itens na fila?
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE O TRIGGER EXISTE E ESTÁ ATIVO
-- ============================================================================
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    tgenabled AS enabled,
    CASE tgenabled
        WHEN 'O' THEN '✅ ATIVO'
        WHEN 'D' THEN '❌ DESABILITADO'
        WHEN 'R' THEN '❌ REPLICA'
        WHEN 'A' THEN '❌ ALWAYS'
        ELSE '❓ DESCONHECIDO'
    END AS status
FROM pg_trigger
WHERE tgname = 'trg_after_cashback_created'
    AND tgrelid = 'sistemaretiradas.cashback_transactions'::regclass;

-- ============================================================================
-- 2. VERIFICAR TRANSAÇÕES RECENTES E POR QUE NÃO FORAM PARA A FILA
-- ============================================================================
SELECT 
    ct.id AS transaction_id,
    ct.transaction_type,
    ct.amount AS valor_cashback,
    ct.created_at AS transacao_criada_em,
    ct.cliente_id,
    ct.store_id AS store_id_transacao,
    
    -- Verificar se tem item na fila
    CASE 
        WHEN cwq.id IS NOT NULL THEN '✅ Na fila'
        ELSE '❌ SEM item na fila'
    END AS status_fila,
    
    -- Verificar dados do cliente
    COALESCE(crm.nome, tiny.nome) AS cliente_nome,
    COALESCE(crm.telefone, tiny.telefone) AS cliente_telefone,
    CASE 
        WHEN COALESCE(crm.telefone, tiny.telefone) IS NULL OR COALESCE(crm.telefone, tiny.telefone) = '' THEN '❌ Sem telefone'
        ELSE '✅ Tem telefone'
    END AS validacao_telefone,
    
    -- Verificar store_id
    COALESCE(ct.store_id, crm.store_id, tiny.store_id) AS store_id_final,
    CASE 
        WHEN COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NULL THEN '❌ Sem store_id'
        ELSE '✅ Tem store_id'
    END AS validacao_store_id,
    
    -- Verificar configurações da loja
    s.name AS loja_nome,
    s.whatsapp_ativo,
    s.cashback_ativo,
    CASE 
        WHEN s.whatsapp_ativo IS FALSE THEN '❌ WhatsApp desativado'
        WHEN s.cashback_ativo IS FALSE THEN '❌ Cashback desativado'
        WHEN s.whatsapp_ativo IS TRUE AND s.cashback_ativo IS TRUE THEN '✅ Loja OK'
        ELSE '❓ Loja não encontrada'
    END AS validacao_loja

FROM sistemaretiradas.cashback_transactions ct
LEFT JOIN sistemaretiradas.cashback_whatsapp_queue cwq 
    ON cwq.transaction_id = ct.id
LEFT JOIN sistemaretiradas.crm_contacts crm
    ON crm.id = ct.cliente_id
LEFT JOIN sistemaretiradas.tiny_contacts tiny
    ON tiny.id = ct.cliente_id
LEFT JOIN sistemaretiradas.stores s
    ON s.id = COALESCE(ct.store_id, crm.store_id, tiny.store_id)
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND cwq.id IS NULL  -- Apenas as que NÃO estão na fila
ORDER BY ct.created_at DESC
LIMIT 50;

-- ============================================================================
-- 3. RESUMO: Motivos pelos quais não foram para a fila
-- ============================================================================
SELECT 
    COUNT(*) AS total_transacoes_sem_fila,
    COUNT(*) FILTER (WHERE COALESCE(crm.telefone, tiny.telefone) IS NULL OR COALESCE(crm.telefone, tiny.telefone) = '') AS sem_telefone,
    COUNT(*) FILTER (WHERE COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NULL) AS sem_store_id,
    COUNT(*) FILTER (WHERE s.whatsapp_ativo IS FALSE) AS whatsapp_desativado,
    COUNT(*) FILTER (WHERE s.cashback_ativo IS FALSE) AS cashback_desativado,
    COUNT(*) FILTER (
        WHERE COALESCE(crm.telefone, tiny.telefone) IS NOT NULL 
        AND COALESCE(crm.telefone, tiny.telefone) != ''
        AND COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NOT NULL
        AND s.whatsapp_ativo IS TRUE
        AND s.cashback_ativo IS TRUE
    ) AS deveria_estar_na_fila
FROM sistemaretiradas.cashback_transactions ct
LEFT JOIN sistemaretiradas.crm_contacts crm
    ON crm.id = ct.cliente_id
LEFT JOIN sistemaretiradas.tiny_contacts tiny
    ON tiny.id = ct.cliente_id
LEFT JOIN sistemaretiradas.stores s
    ON s.id = COALESCE(ct.store_id, crm.store_id, tiny.store_id)
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND NOT EXISTS (
        SELECT 1 
        FROM sistemaretiradas.cashback_whatsapp_queue cwq
        WHERE cwq.transaction_id = ct.id
    );

-- ============================================================================
-- 4. TESTAR A FUNÇÃO ENQUEUE DIRETAMENTE
-- ============================================================================
-- Testar com uma transação que deveria estar na fila mas não está
-- IMPORTANTE: Descomente e substitua o UUID por uma transaction_id real do resultado da query 2

DO $$
DECLARE
    v_test_transaction_id UUID := '7246a7a0-645c-46da-8f09-44cf5b361491'; -- Exemplo: Matheus Martins Pinheiro
    v_test_cliente_id UUID;
    v_test_store_id UUID;
    v_result TEXT;
    v_queue_id UUID;
BEGIN
    -- Buscar dados da transação
    SELECT cliente_id, store_id 
    INTO v_test_cliente_id, v_test_store_id
    FROM sistemaretiradas.cashback_transactions
    WHERE id = v_test_transaction_id;
    
    IF v_test_cliente_id IS NULL THEN
        RAISE NOTICE '❌ Transação % sem cliente_id', v_test_transaction_id;
        RETURN;
    END IF;
    
    IF v_test_store_id IS NULL THEN
        RAISE NOTICE '⚠️ Transação % sem store_id, tentando buscar do cliente...', v_test_transaction_id;
        SELECT store_id INTO v_test_store_id
        FROM sistemaretiradas.crm_contacts
        WHERE id = v_test_cliente_id;
        
        IF v_test_store_id IS NULL THEN
            SELECT store_id INTO v_test_store_id
            FROM sistemaretiradas.tiny_contacts
            WHERE id = v_test_cliente_id;
        END IF;
    END IF;
    
    IF v_test_store_id IS NULL THEN
        RAISE NOTICE '❌ Transação % sem store_id', v_test_transaction_id;
        RETURN;
    END IF;
    
    RAISE NOTICE '📋 Testando enqueue para transação % (cliente: %, loja: %)', v_test_transaction_id, v_test_cliente_id, v_test_store_id;
    
    -- Tentar enfileirar
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_test_transaction_id,
            v_test_cliente_id,
            v_test_store_id
        );
        
        -- Verificar se foi criado
        SELECT id INTO v_queue_id
        FROM sistemaretiradas.cashback_whatsapp_queue
        WHERE transaction_id = v_test_transaction_id;
        
        IF v_queue_id IS NOT NULL THEN
            RAISE NOTICE '✅ Item criado na fila com ID: %', v_queue_id;
        ELSE
            RAISE NOTICE '⚠️ Função executou mas item não foi criado na fila';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao executar enqueue: %', SQLERRM;
    END;
END $$;

-- ============================================================================
-- 5. LISTAR TRANSAÇÕES QUE DEVERIAM ESTAR NA FILA
-- ============================================================================
SELECT 
    ct.id AS transaction_id,
    ct.amount AS valor_cashback,
    ct.created_at,
    COALESCE(crm.nome, tiny.nome) AS cliente_nome,
    COALESCE(crm.telefone, tiny.telefone) AS cliente_telefone,
    COALESCE(ct.store_id, crm.store_id, tiny.store_id) AS store_id,
    s.name AS loja_nome,
    '⚠️ DEVERIA estar na fila' AS problema
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
LIMIT 20;

-- ============================================================================
-- 6. VERIFICAR SE HÁ CONFLITO DE CONSTRAINTS NA TABELA
-- ============================================================================
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.cashback_whatsapp_queue'::regclass
ORDER BY contype, conname;

