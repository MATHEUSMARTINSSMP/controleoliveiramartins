-- ============================================================================
-- FIX COMPLETO: Trigger trg_after_cashback_created
-- Data: 2025-12-15
-- 
-- PROBLEMA: O trigger estava chamando enqueue_cashback_whatsapp com poucos parâmetros
-- ou não estava passando os dados do cliente corretamente.
--
-- SOLUÇÃO: Recriar o trigger para buscar todos os dados do cliente e passar
-- para a função enqueue corretamente.
-- ============================================================================

-- ============================================================================
-- PARTE 1: Dropar versões antigas/conflitantes da função enqueue
-- ============================================================================

-- Dropar todas as versões para evitar ambiguidade
DROP FUNCTION IF EXISTS sistemaretiradas.enqueue_cashback_whatsapp(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS sistemaretiradas.enqueue_cashback_whatsapp(uuid, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS sistemaretiradas.enqueue_cashback_whatsapp(uuid, text, text, numeric, numeric, uuid, uuid);

-- ============================================================================
-- PARTE 2: Criar versão única e completa da função enqueue
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

    -- Buscar dados do cliente (tentar crm_contacts primeiro, depois tiny_contacts)
    SELECT nome, telefone INTO v_cliente_nome, v_cliente_telefone
    FROM sistemaretiradas.crm_contacts
    WHERE id = p_cliente_id;

    IF v_cliente_nome IS NULL THEN
        SELECT nome, telefone INTO v_cliente_nome, v_cliente_telefone
        FROM sistemaretiradas.tiny_contacts
        WHERE id = p_cliente_id;
    END IF;

    -- Buscar saldo total do cliente
    SELECT COALESCE(balance, 0) INTO v_saldo_total
    FROM sistemaretiradas.cashback_balance
    WHERE cliente_id = p_cliente_id;

    IF v_saldo_total IS NULL THEN
        v_saldo_total := v_valor_cashback;
    END IF;

    -- Se não tem telefone, não enfileirar
    IF v_cliente_telefone IS NULL OR v_cliente_telefone = '' THEN
        RAISE NOTICE 'Cliente % sem telefone, WhatsApp não enfileirado', p_cliente_id;
        RETURN;
    END IF;

    -- Inserir na fila
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
    );
    
    RAISE NOTICE 'WhatsApp de cashback enfileirado para % (tel: %, loja: %, valor: %)', 
        v_cliente_nome, v_cliente_telefone, p_store_id, v_valor_cashback;
END;
$$;

-- ============================================================================
-- PARTE 3: Dropar e Recriar o Trigger
-- ============================================================================

-- Dropar trigger existente
DROP TRIGGER IF EXISTS trg_after_cashback_created ON sistemaretiradas.cashback_transactions;

-- Dropar função do trigger
DROP FUNCTION IF EXISTS sistemaretiradas.fn_after_cashback_created();

-- Criar função do trigger que busca os dados e chama enqueue
CREATE OR REPLACE FUNCTION sistemaretiradas.fn_after_cashback_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_whatsapp_ativo BOOLEAN;
    v_cashback_ativo BOOLEAN;
BEGIN
    -- Só processar transações do tipo EARNED (cashback gerado)
    IF NEW.transaction_type != 'EARNED' THEN
        RETURN NEW;
    END IF;

    -- Obter store_id da transação ou buscar do cliente
    v_store_id := NEW.store_id;

    -- Se store_id for NULL, tentar buscar do cliente
    IF v_store_id IS NULL THEN
        -- Tentar buscar de crm_contacts
        SELECT store_id INTO v_store_id
        FROM sistemaretiradas.crm_contacts
        WHERE id = NEW.cliente_id;

        -- Se ainda for NULL, tentar de tiny_contacts
        IF v_store_id IS NULL THEN
            SELECT store_id INTO v_store_id
            FROM sistemaretiradas.tiny_contacts
            WHERE id = NEW.cliente_id;
        END IF;
    END IF;

    -- Se ainda não temos store_id, não podemos enviar WhatsApp
    IF v_store_id IS NULL THEN
        RAISE NOTICE 'Transação % sem store_id, WhatsApp não enfileirado', NEW.id;
        RETURN NEW;
    END IF;

    -- Verificar se a loja tem WhatsApp e Cashback ativos
    SELECT whatsapp_ativo, cashback_ativo 
    INTO v_whatsapp_ativo, v_cashback_ativo
    FROM sistemaretiradas.stores
    WHERE id = v_store_id;

    -- Se WhatsApp estiver desativado, não enfileirar
    IF v_whatsapp_ativo IS FALSE THEN
        RAISE NOTICE 'Loja % tem WhatsApp desativado, não enfileirando', v_store_id;
        RETURN NEW;
    END IF;

    -- Se Cashback estiver desativado, não enfileirar
    IF v_cashback_ativo IS FALSE THEN
        RAISE NOTICE 'Loja % tem Cashback desativado, não enfileirando', v_store_id;
        RETURN NEW;
    END IF;

    -- Chamar a função de enqueue (que busca os dados do cliente internamente)
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            NEW.id,           -- transaction_id
            NEW.cliente_id,   -- cliente_id
            v_store_id        -- store_id
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao enfileirar WhatsApp para transação %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER trg_after_cashback_created
    AFTER INSERT ON sistemaretiradas.cashback_transactions
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.fn_after_cashback_created();

-- ============================================================================
-- PARTE 4: Atualizar itens existentes na fila que estão com dados NULL
-- ============================================================================

UPDATE sistemaretiradas.cashback_whatsapp_queue q
SET 
    cliente_nome = COALESCE(
        (SELECT nome FROM sistemaretiradas.crm_contacts WHERE id = q.cliente_id),
        (SELECT nome FROM sistemaretiradas.tiny_contacts WHERE id = q.cliente_id)
    ),
    cliente_telefone = COALESCE(
        (SELECT telefone FROM sistemaretiradas.crm_contacts WHERE id = q.cliente_id),
        (SELECT telefone FROM sistemaretiradas.tiny_contacts WHERE id = q.cliente_id)
    ),
    valor_cashback = COALESCE(
        q.valor_cashback,
        (SELECT amount FROM sistemaretiradas.cashback_transactions WHERE id = q.transaction_id)
    ),
    saldo_total = COALESCE(
        q.saldo_total,
        (SELECT balance FROM sistemaretiradas.cashback_balance WHERE cliente_id = q.cliente_id)
    )
WHERE q.cliente_nome IS NULL 
   OR q.cliente_telefone IS NULL
   OR q.valor_cashback IS NULL;

-- ============================================================================
-- PARTE 5: Atualizar transações sem store_id
-- ============================================================================

UPDATE sistemaretiradas.cashback_transactions ct
SET store_id = COALESCE(
    (SELECT store_id FROM sistemaretiradas.crm_contacts WHERE id = ct.cliente_id),
    (SELECT store_id FROM sistemaretiradas.tiny_contacts WHERE id = ct.cliente_id)
)
WHERE ct.store_id IS NULL
AND ct.transaction_type = 'EARNED';

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_pending_count INTEGER;
    v_null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_pending_count
    FROM sistemaretiradas.cashback_whatsapp_queue
    WHERE status = 'PENDING';

    SELECT COUNT(*) INTO v_null_count
    FROM sistemaretiradas.cashback_whatsapp_queue
    WHERE cliente_nome IS NULL OR cliente_telefone IS NULL;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICAÇÃO FINAL';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Itens PENDING na fila: %', v_pending_count;
    RAISE NOTICE 'Itens com dados NULL: %', v_null_count;
    RAISE NOTICE '============================================================';
END $$;
