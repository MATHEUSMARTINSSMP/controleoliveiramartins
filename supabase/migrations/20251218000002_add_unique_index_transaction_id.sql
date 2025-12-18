-- ============================================================================
-- FIX: Adicionar índice único em transaction_id e melhorar função enqueue
-- Data: 2025-12-18
-- 
-- PROBLEMA: A função enqueue não trata duplicatas corretamente
-- SOLUÇÃO: 
--   1. Adicionar índice único em transaction_id (com tratamento de duplicatas existentes)
--   2. Adicionar ON CONFLICT na função enqueue
--   3. Melhorar tratamento de erros
-- ============================================================================

-- ============================================================================
-- PARTE 1: Limpar Duplicatas e Criar Índice Único
-- ============================================================================

-- NOTA: A tabela já possui um constraint UNIQUE em transaction_id
-- Esta migration apenas atualiza a função enqueue para usar ON CONFLICT corretamente

-- Remover índice não-único se existir (se houver)
DROP INDEX IF EXISTS sistemaretiradas.idx_cashback_whatsapp_queue_transaction;

-- Verificar se há duplicatas (pode acontecer se o índice único não existia antes)
DO $$
DECLARE
    v_duplicatas INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicatas
    FROM (
        SELECT transaction_id, COUNT(*) as cnt
        FROM sistemaretiradas.cashback_whatsapp_queue
        WHERE transaction_id IS NOT NULL
        GROUP BY transaction_id
        HAVING COUNT(*) > 1
    ) dup;
    
    IF v_duplicatas > 0 THEN
        RAISE NOTICE '⚠️ Encontradas % transações duplicadas, limpando...', v_duplicatas;
        
        -- Remover duplicatas, mantendo apenas a mais antiga (ou com status mais recente se PENDING)
        DELETE FROM sistemaretiradas.cashback_whatsapp_queue cwq1
        WHERE cwq1.id IN (
            SELECT cwq2.id
            FROM sistemaretiradas.cashback_whatsapp_queue cwq2
            WHERE cwq2.transaction_id IS NOT NULL
                AND cwq2.id > (
                    SELECT MIN(cwq3.id)
                    FROM sistemaretiradas.cashback_whatsapp_queue cwq3
                    WHERE cwq3.transaction_id = cwq2.transaction_id
                    ORDER BY 
                        CASE cwq3.status 
                            WHEN 'PENDING' THEN 1 
                            WHEN 'PROCESSING' THEN 2 
                            ELSE 3 
                        END,
                        cwq3.created_at ASC
                    LIMIT 1
                )
        );
        
        RAISE NOTICE '✅ Duplicatas removidas';
    ELSE
        RAISE NOTICE '✅ Nenhuma duplicata encontrada';
    END IF;
END $$;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_transaction_unique 
ON sistemaretiradas.cashback_whatsapp_queue(transaction_id)
WHERE transaction_id IS NOT NULL;

-- ============================================================================
-- PARTE 2: Atualizar Função enqueue_cashback_whatsapp com ON CONFLICT
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_transaction_id UUID,
    p_cliente_id UUID,
    p_store_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_nome TEXT;
    v_cliente_telefone TEXT;
    v_valor_cashback NUMERIC;
    v_saldo_total NUMERIC;
BEGIN
    -- Buscar dados da transação
    SELECT amount INTO v_valor_cashback
    FROM sistemaretiradas.cashback_transactions
    WHERE id = p_transaction_id;

    IF v_valor_cashback IS NULL THEN
        RAISE WARNING '[enqueue_cashback_whatsapp] Transação % não encontrada', p_transaction_id;
        RETURN;
    END IF;

    -- Buscar dados do cliente (tentar crm_contacts primeiro, depois tiny_contacts)
    SELECT nome, telefone INTO v_cliente_nome, v_cliente_telefone
    FROM sistemaretiradas.crm_contacts
    WHERE id = p_cliente_id;

    IF v_cliente_nome IS NULL OR v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
        SELECT nome, telefone INTO v_cliente_nome, v_cliente_telefone
        FROM sistemaretiradas.tiny_contacts
        WHERE id = p_cliente_id;
    END IF;

    -- Se não tem telefone, não enfileirar
    IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
        RAISE NOTICE '[enqueue_cashback_whatsapp] Cliente % sem telefone, WhatsApp não enfileirado', p_cliente_id;
        RETURN;
    END IF;

    -- Buscar saldo total do cliente
    SELECT COALESCE(balance, 0) INTO v_saldo_total
    FROM sistemaretiradas.cashback_balance
    WHERE cliente_id = p_cliente_id;

    IF v_saldo_total IS NULL THEN
        v_saldo_total := v_valor_cashback;
    END IF;

    -- Inserir na fila com ON CONFLICT para evitar duplicatas
    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        transaction_id,
        cliente_id,
        store_id,
        cliente_nome,
        cliente_telefone,
        valor_cashback,
        saldo_total,
        status,
        attempts
    ) VALUES (
        p_transaction_id,
        p_cliente_id,
        p_store_id,
        v_cliente_nome,
        v_cliente_telefone,
        v_valor_cashback,
        v_saldo_total,
        'PENDING',
        0
    )
    ON CONFLICT (transaction_id) -- Usa o constraint único cashback_whatsapp_queue_transaction_id_key
    DO UPDATE SET
        updated_at = NOW(),
        -- Se estava como FAILED, resetar para PENDING para tentar novamente
        status = CASE 
            WHEN cashback_whatsapp_queue.status = 'FAILED' THEN 'PENDING'::TEXT
            ELSE cashback_whatsapp_queue.status
        END,
        attempts = CASE
            WHEN cashback_whatsapp_queue.status = 'FAILED' THEN 0
            ELSE cashback_whatsapp_queue.attempts
        END;
    
    RAISE NOTICE '[enqueue_cashback_whatsapp] ✅ WhatsApp enfileirado para % (tel: %, loja: %, valor: %)', 
        v_cliente_nome, v_cliente_telefone, p_store_id, v_valor_cashback;
EXCEPTION WHEN OTHERS THEN
    -- Log do erro mas não propagar para não afetar a transação principal
    RAISE WARNING '[enqueue_cashback_whatsapp] ❌ Erro ao enfileirar transação %: %', p_transaction_id, SQLERRM;
END;
$$;

