-- ============================================================================
-- REPROCESSAR: Transações específicas que deveriam estar na fila
-- Data: 2025-12-18
-- 
-- Esta query reprocessa as transações listadas que deveriam estar na fila
-- mas não foram adicionadas porque foram criadas antes do trigger existir
-- ============================================================================

DO $$
DECLARE
    v_transaction_id UUID;
    v_cliente_id UUID;
    v_store_id UUID;
    v_count_success INTEGER := 0;
    v_count_error INTEGER := 0;
    v_count_skipped INTEGER := 0;
    v_error_msg TEXT;
BEGIN
    -- Lista de transações para reprocessar (copiada do resultado da query de diagnóstico)
    FOR v_transaction_id IN
        SELECT unnest(ARRAY[
            '195898c7-7cbe-41e6-a240-15adc65f5e1d'::UUID,
            '15bc1b9b-014b-46f1-818a-dd929226639a'::UUID,
            '2f8d1aa0-2035-483b-8c60-df1b2dc5cc79'::UUID,
            '667181be-e8a4-4c79-87ff-15e19a254947'::UUID,
            '1615d99b-60e3-4d7a-a97d-1b2a8f5debf1'::UUID,
            'c7c84b56-58df-4f1a-9edc-9a2413b82ede'::UUID,
            '417ed33d-7d2c-4bee-8685-ee54b31e9ea6'::UUID,
            'd7b0494e-c0fb-4870-8295-1ae637a83012'::UUID,
            'a736a00d-4c8d-4554-871d-3616270b9186'::UUID,
            '3f902834-5ad6-465a-b601-ee26aaa758cb'::UUID,
            'a5132d63-1808-4939-953d-8d513fc85a0d'::UUID,
            'fcd84726-4bcd-4272-b9a9-0a5bbc99ec89'::UUID,
            '1d4d45ef-5ef8-4aea-9367-55faa98c3e5d'::UUID,
            'ff67226d-7601-4fd4-9ee5-69ba681aa521'::UUID,
            '5d669785-6627-4480-ab25-70e954ab6bfc'::UUID,
            'be3137bc-0926-4602-b1d0-dd31bdf5daea'::UUID,
            '14611bb8-7337-4ba1-9833-8c89d41f6b6a'::UUID,
            '2e60849f-fc20-4d49-852d-68e5d84be7aa'::UUID,
            '6d9752c3-480f-4f5d-877d-62d88d7ffefe'::UUID,
            '8fcf6005-9f37-4430-bfac-21764505eeb7'::UUID
        ])
    LOOP
        -- Buscar cliente_id e store_id da transação
        SELECT cliente_id, store_id INTO v_cliente_id, v_store_id
        FROM sistemaretiradas.cashback_transactions
        WHERE id = v_transaction_id;
        
        -- Se não encontrou a transação, pular
        IF v_cliente_id IS NULL THEN
            v_count_skipped := v_count_skipped + 1;
            RAISE NOTICE '⚠️ [%] Transação não encontrada', v_transaction_id;
            CONTINUE;
        END IF;
        
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
        
        -- Se ainda não tem store_id, pular
        IF v_store_id IS NULL THEN
            v_count_skipped := v_count_skipped + 1;
            RAISE NOTICE '⚠️ [%] Transação sem store_id', v_transaction_id;
            CONTINUE;
        END IF;
        
        -- Verificar se já existe na fila
        IF EXISTS (
            SELECT 1 
            FROM sistemaretiradas.cashback_whatsapp_queue
            WHERE transaction_id = v_transaction_id
        ) THEN
            v_count_skipped := v_count_skipped + 1;
            RAISE NOTICE 'ℹ️  [%] Já existe na fila, pulando', v_transaction_id;
            CONTINUE;
        END IF;
        
        -- Tentar enfileirar
        BEGIN
            PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
                v_transaction_id,
                v_cliente_id,
                v_store_id
            );
            
            v_count_success := v_count_success + 1;
            RAISE NOTICE '✅ [%/%] Adicionado à fila: %', v_count_success, v_transaction_id, v_transaction_id;
        EXCEPTION WHEN OTHERS THEN
            v_count_error := v_count_error + 1;
            v_error_msg := SQLERRM;
            RAISE WARNING '❌ [%/%] Erro ao adicionar %: %', v_count_error, v_transaction_id, v_transaction_id, v_error_msg;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RESUMO DO REPROCESSAMENTO';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ Sucessos: %', v_count_success;
    RAISE NOTICE '❌ Erros: %', v_count_error;
    RAISE NOTICE 'ℹ️  Pulados: %', v_count_skipped;
    RAISE NOTICE '📊 Total processado: %', v_count_success + v_count_error + v_count_skipped;
    RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- VERIFICAR RESULTADO
-- ============================================================================
SELECT 
    COUNT(*) AS total_na_fila,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pendentes,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS falhados
FROM sistemaretiradas.cashback_whatsapp_queue
WHERE transaction_id IN (
    '195898c7-7cbe-41e6-a240-15adc65f5e1d',
    '15bc1b9b-014b-46f1-818a-dd929226639a',
    '2f8d1aa0-2035-483b-8c60-df1b2dc5cc79',
    '667181be-e8a4-4c79-87ff-15e19a254947',
    '1615d99b-60e3-4d7a-a97d-1b2a8f5debf1',
    'c7c84b56-58df-4f1a-9edc-9a2413b82ede',
    '417ed33d-7d2c-4bee-8685-ee54b31e9ea6',
    'd7b0494e-c0fb-4870-8295-1ae637a83012',
    'a736a00d-4c8d-4554-871d-3616270b9186',
    '3f902834-5ad6-465a-b601-ee26aaa758cb',
    'a5132d63-1808-4939-953d-8d513fc85a0d',
    'fcd84726-4bcd-4272-b9a9-0a5bbc99ec89',
    '1d4d45ef-5ef8-4aea-9367-55faa98c3e5d',
    'ff67226d-7601-4fd4-9ee5-69ba681aa521',
    '5d669785-6627-4480-ab25-70e954ab6bfc',
    'be3137bc-0926-4602-b1d0-dd31bdf5daea',
    '14611bb8-7337-4ba1-9833-8c89d41f6b6a',
    '2e60849f-fc20-4d49-852d-68e5d84be7aa',
    '6d9752c3-480f-4f5d-877d-62d88d7ffefe',
    '8fcf6005-9f37-4430-bfac-21764505eeb7'
);

