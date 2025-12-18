-- ============================================================================
-- TESTE: Verificação Completa do Sistema de Cashback WhatsApp
-- Data: 2025-12-18
-- 
-- Este script verifica:
-- 1. Se as transações reprocessadas estão na fila
-- 2. Se a função enqueue está funcionando
-- 3. Status geral da fila
-- 4. Se o trigger está funcionando (teste com nova transação)
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR SE AS TRANSAÇÕES REPROCESSADAS ESTÃO NA FILA
-- ============================================================================
SELECT 
    '✅ Transações reprocessadas na fila' AS teste,
    COUNT(*) AS total_na_fila,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pendentes,
    COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END) AS processando,
    COUNT(CASE WHEN status = 'SENT' THEN 1 END) AS enviadas,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS falhadas
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

-- ============================================================================
-- 2. DETALHES DAS TRANSAÇÕES REPROCESSADAS
-- ============================================================================
SELECT 
    cwq.transaction_id,
    cwq.cliente_nome,
    cwq.cliente_telefone,
    cwq.valor_cashback,
    cwq.status AS status_fila,
    cwq.created_at AS criado_em,
    cwq.updated_at AS atualizado_em,
    CASE 
        WHEN cwq.status = 'PENDING' THEN '✅ Aguardando envio'
        WHEN cwq.status = 'PROCESSING' THEN '⏳ Processando'
        WHEN cwq.status = 'SENT' THEN '✅ Enviado'
        WHEN cwq.status = 'FAILED' THEN '❌ Falhou'
        ELSE '❓ ' || cwq.status
    END AS status_descricao
FROM sistemaretiradas.cashback_whatsapp_queue cwq
WHERE cwq.transaction_id IN (
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
)
ORDER BY cwq.created_at DESC;

-- ============================================================================
-- 3. TESTE DA FUNÇÃO ENQUEUE COM UMA TRANSAÇÃO EXISTENTE
-- ============================================================================
-- Testar se a função enqueue funciona corretamente (deve usar ON CONFLICT)
DO $$
DECLARE
    v_test_transaction_id UUID := '195898c7-7cbe-41e6-a240-15adc65f5e1d';
    v_cliente_id UUID;
    v_store_id UUID;
    v_queue_id UUID;
    v_status_antes TEXT;
    v_status_depois TEXT;
BEGIN
    -- Buscar dados da transação
    SELECT cliente_id, store_id INTO v_cliente_id, v_store_id
    FROM sistemaretiradas.cashback_transactions
    WHERE id = v_test_transaction_id;
    
    -- Buscar status antes
    SELECT status INTO v_status_antes
    FROM sistemaretiradas.cashback_whatsapp_queue
    WHERE transaction_id = v_test_transaction_id;
    
    RAISE NOTICE '📋 Testando função enqueue_cashback_whatsapp';
    RAISE NOTICE '   Transação: %', v_test_transaction_id;
    RAISE NOTICE '   Cliente: %', v_cliente_id;
    RAISE NOTICE '   Loja: %', v_store_id;
    RAISE NOTICE '   Status antes: %', COALESCE(v_status_antes, 'NÃO EXISTE');
    
    -- Chamar a função (deve usar ON CONFLICT e não dar erro)
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_test_transaction_id,
            v_cliente_id,
            v_store_id
        );
        
        -- Verificar se existe
        SELECT id, status INTO v_queue_id, v_status_depois
        FROM sistemaretiradas.cashback_whatsapp_queue
        WHERE transaction_id = v_test_transaction_id;
        
        IF v_queue_id IS NOT NULL THEN
            RAISE NOTICE '✅ Função executada com sucesso!';
            RAISE NOTICE '   ID na fila: %', v_queue_id;
            RAISE NOTICE '   Status depois: %', v_status_depois;
        ELSE
            RAISE WARNING '⚠️ Função executou mas item não foi criado/encontrado';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Erro ao executar função: %', SQLERRM;
    END;
END $$;

-- ============================================================================
-- 4. STATUS GERAL DA FILA
-- ============================================================================
SELECT 
    '📊 Status Geral da Fila' AS teste,
    status,
    COUNT(*) AS quantidade,
    MIN(created_at) AS primeira_criacao,
    MAX(created_at) AS ultima_criacao,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) AS ultimas_24h
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
-- 5. VERIFICAR SE O TRIGGER ESTÁ ATIVO
-- ============================================================================
SELECT 
    '🔍 Verificação do Trigger' AS teste,
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    CASE tgenabled
        WHEN 'O' THEN '✅ ATIVO'
        WHEN 'D' THEN '❌ DESABILITADO'
        WHEN 'R' THEN '⚠️ REPLICA'
        WHEN 'A' THEN '⚠️ ALWAYS'
        ELSE '❓ DESCONHECIDO'
    END AS status_trigger,
    pg_get_triggerdef(oid) AS definicao
FROM pg_trigger
WHERE tgname = 'trg_after_cashback_created'
    AND tgrelid = 'sistemaretiradas.cashback_transactions'::regclass;

-- ============================================================================
-- 6. TESTE DE TRANSAÇÕES RECENTES (verificar se trigger está funcionando)
-- ============================================================================
SELECT 
    '🔍 Transações EARNED Recentes (últimas 24h)' AS teste,
    COUNT(*) AS total_transacoes,
    COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_whatsapp_queue cwq 
        WHERE cwq.transaction_id = ct.id
    ) THEN 1 END) AS com_item_na_fila,
    COUNT(CASE WHEN NOT EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_whatsapp_queue cwq 
        WHERE cwq.transaction_id = ct.id
    ) THEN 1 END) AS sem_item_na_fila,
    ROUND(
        COUNT(CASE WHEN EXISTS (
            SELECT 1 FROM sistemaretiradas.cashback_whatsapp_queue cwq 
            WHERE cwq.transaction_id = ct.id
        ) THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 
        2
    ) AS percentual_na_fila
FROM sistemaretiradas.cashback_transactions ct
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= CURRENT_DATE - INTERVAL '24 hours';

-- ============================================================================
-- 7. DETALHES DE TRANSAÇÕES RECENTES SEM ITEM NA FILA (problema potencial)
-- ============================================================================
SELECT 
    '⚠️ Transações Recentes SEM Item na Fila' AS aviso,
    ct.id AS transaction_id,
    ct.amount AS valor_cashback,
    ct.created_at,
    COALESCE(crm.nome, tiny.nome) AS cliente_nome,
    COALESCE(crm.telefone, tiny.telefone) AS cliente_telefone,
    s.name AS loja_nome,
    s.whatsapp_ativo,
    s.cashback_ativo,
    CASE 
        WHEN ct.cliente_id IS NULL THEN '❌ Sem cliente_id'
        WHEN COALESCE(crm.telefone, tiny.telefone) IS NULL THEN '❌ Cliente sem telefone'
        WHEN COALESCE(ct.store_id, crm.store_id, tiny.store_id) IS NULL THEN '❌ Sem store_id'
        WHEN s.whatsapp_ativo IS FALSE THEN '❌ WhatsApp desativado'
        WHEN s.cashback_ativo IS FALSE THEN '❌ Cashback desativado'
        ELSE '❓ Motivo desconhecido'
    END AS motivo_provavel
FROM sistemaretiradas.cashback_transactions ct
LEFT JOIN sistemaretiradas.crm_contacts crm ON crm.id = ct.cliente_id
LEFT JOIN sistemaretiradas.tiny_contacts tiny ON tiny.id = ct.cliente_id
LEFT JOIN sistemaretiradas.stores s ON s.id = COALESCE(ct.store_id, crm.store_id, tiny.store_id)
WHERE ct.transaction_type = 'EARNED'
    AND ct.created_at >= CURRENT_DATE - INTERVAL '24 hours'
    AND NOT EXISTS (
        SELECT 1 
        FROM sistemaretiradas.cashback_whatsapp_queue cwq
        WHERE cwq.transaction_id = ct.id
    )
ORDER BY ct.created_at DESC
LIMIT 10;

