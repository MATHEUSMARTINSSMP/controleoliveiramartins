-- ============================================================================
-- SCRIPT COMPLETO: FIX CASHBACK SYSTEM 100%
-- Execute este script no Supabase SQL Editor
-- É IDEMPOTENTE - pode ser executado múltiplas vezes sem problemas
-- ============================================================================

-- ============================================================================
-- PARTE 1: PREPARAR TABELAS
-- ============================================================================

-- 1.1 Adicionar sale_id em cashback_transactions
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE CASCADE;

-- 1.2 Tornar tiny_order_id opcional
ALTER TABLE sistemaretiradas.cashback_transactions
ALTER COLUMN tiny_order_id DROP NOT NULL;

-- 1.3 Remover FK estrita de cliente_id em cashback_transactions
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_transactions_cliente_id_fkey'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_transactions
        DROP CONSTRAINT cashback_transactions_cliente_id_fkey;
    END IF;
END $$;

-- 1.4 Remover FK estrita de cliente_id em cashback_balance
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_balance_cliente_id_fkey'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_balance
        DROP CONSTRAINT cashback_balance_cliente_id_fkey;
    END IF;
END $$;

-- 1.5 Adicionar colaboradora_id em cashback_balance se não existir
ALTER TABLE sistemaretiradas.cashback_balance
ADD COLUMN IF NOT EXISTS colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id);

-- 1.6 Adicionar store_id em cashback_balance se não existir
ALTER TABLE sistemaretiradas.cashback_balance
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id);

-- ============================================================================
-- PARTE 2: FUNÇÃO GERAR_CASHBACK
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
    p_tiny_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id UUID;
    v_cliente_nome TEXT;
    v_cliente_telefone TEXT;
    v_valor_venda NUMERIC;
    v_percentual_cashback NUMERIC;
    v_valor_cashback NUMERIC;
    v_colaboradora_id UUID;
    v_store_id UUID;
    v_transaction_id UUID;
    v_saldo_anterior NUMERIC;
    v_saldo_novo NUMERIC;
BEGIN
    -- Buscar dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            COALESCE(s.cliente_id, s.tiny_contact_id),
            COALESCE(s.cliente_nome, tc.nome),
            COALESCE(s.cliente_telefone, tc.telefone),
            s.valor,
            s.colaboradora_id,
            s.store_id
        INTO 
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_venda,
            v_colaboradora_id,
            v_store_id
        FROM sistemaretiradas.sales s
        LEFT JOIN sistemaretiradas.tiny_contacts tc ON tc.id = s.tiny_contact_id
        WHERE s.id = p_sale_id;
    ELSIF p_tiny_order_id IS NOT NULL THEN
        SELECT 
            tor.cliente_id,
            tc.nome,
            tc.telefone,
            tor.valor_total,
            tor.colaboradora_id,
            tor.store_id
        INTO 
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_venda,
            v_colaboradora_id,
            v_store_id
        FROM sistemaretiradas.tiny_orders tor
        LEFT JOIN sistemaretiradas.tiny_contacts tc ON tc.id = tor.cliente_id
        WHERE tor.id = p_tiny_order_id;
    ELSE
        RAISE EXCEPTION 'Deve fornecer p_sale_id ou p_tiny_order_id';
    END IF;

    -- Verificar se encontrou a venda
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente não encontrado'
        );
    END IF;

    -- Buscar percentual de cashback
    SELECT COALESCE(percentual_cashback, 5) INTO v_percentual_cashback
    FROM sistemaretiradas.cashback_config
    WHERE id = 1;

    -- Calcular cashback (arredondar para cima)
    v_valor_cashback := CEIL((v_valor_venda * v_percentual_cashback / 100));

    -- Inserir transação
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        tipo,
        valor,
        saldo_anterior,
        saldo_novo,
        descricao,
        tiny_order_id,
        sale_id,
        colaboradora_id,
        store_id
    ) VALUES (
        v_cliente_id,
        'CREDITO',
        v_valor_cashback,
        0, -- será atualizado abaixo
        0, -- será atualizado abaixo
        'Cashback de compra',
        p_tiny_order_id,
        p_sale_id,
        v_colaboradora_id,
        v_store_id
    ) RETURNING id INTO v_transaction_id;

    -- Atualizar ou criar saldo
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        saldo_disponivel,
        saldo_utilizado,
        colaboradora_id,
        store_id
    ) VALUES (
        v_cliente_id,
        v_valor_cashback,
        0,
        v_colaboradora_id,
        v_store_id
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET 
        saldo_disponivel = sistemaretiradas.cashback_balance.saldo_disponivel + v_valor_cashback,
        updated_at = NOW()
    RETURNING 
        saldo_disponivel - v_valor_cashback,
        saldo_disponivel
    INTO v_saldo_anterior, v_saldo_novo;

    -- Atualizar transação com saldos corretos
    UPDATE sistemaretiradas.cashback_transactions
    SET 
        saldo_anterior = v_saldo_anterior,
        saldo_novo = v_saldo_novo
    WHERE id = v_transaction_id;

    -- Enfileirar WhatsApp
    PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
        v_cliente_id,
        v_cliente_nome,
        v_cliente_telefone,
        v_valor_cashback,
        v_saldo_novo
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'valor_cashback', v_valor_cashback,
        'saldo_novo', v_saldo_novo
    );
END;
$$;

-- ============================================================================
-- PARTE 3: FUNÇÃO ENQUEUE_CASHBACK_WHATSAPP
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_cliente_id UUID,
    p_cliente_nome TEXT,
    p_cliente_telefone TEXT,
    p_valor_cashback NUMERIC,
    p_saldo_total NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        cliente_id,
        cliente_nome,
        cliente_telefone,
        valor_cashback,
        saldo_total,
        status
    ) VALUES (
        p_cliente_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_valor_cashback,
        p_saldo_total,
        'PENDING'
    );
END;
$$;

-- ============================================================================
-- PARTE 4: TRIGGER NA TABELA SALES
-- ============================================================================

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_sale ON sistemaretiradas.sales;

-- Criar função do trigger
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_new_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Gerar cashback para a nova venda
    PERFORM sistemaretiradas.gerar_cashback(p_sale_id := NEW.id);
    RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER trg_gerar_cashback_new_sale
AFTER INSERT ON sistemaretiradas.sales
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_new_sale();

-- ============================================================================
-- PARTE 5: REMOVER TRIGGER ANTIGO DE TINY_ORDERS (SE EXISTIR)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_gerar_cashback ON sistemaretiradas.tiny_orders;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_has_trigger BOOLEAN;
    v_has_function BOOLEAN;
    v_has_queue_function BOOLEAN;
BEGIN
    -- Verificar trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_gerar_cashback_new_sale'
    ) INTO v_has_trigger;

    -- Verificar função gerar_cashback
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'gerar_cashback'
        AND pronamespace = 'sistemaretiradas'::regnamespace
    ) INTO v_has_function;

    -- Verificar função enqueue
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'enqueue_cashback_whatsapp'
        AND pronamespace = 'sistemaretiradas'::regnamespace
    ) INTO v_has_queue_function;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICAÇÃO DO SISTEMA DE CASHBACK';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Trigger trg_gerar_cashback_new_sale: %', CASE WHEN v_has_trigger THEN '✅ OK' ELSE '❌ FALTANDO' END;
    RAISE NOTICE 'Função gerar_cashback: %', CASE WHEN v_has_function THEN '✅ OK' ELSE '❌ FALTANDO' END;
    RAISE NOTICE 'Função enqueue_cashback_whatsapp: %', CASE WHEN v_has_queue_function THEN '✅ OK' ELSE '❌ FALTANDO' END;
    RAISE NOTICE '============================================================';
    
    IF v_has_trigger AND v_has_function AND v_has_queue_function THEN
        RAISE NOTICE '✅ SISTEMA DE CASHBACK INSTALADO COM SUCESSO!';
    ELSE
        RAISE EXCEPTION '❌ ERRO: Algum componente está faltando';
    END IF;
END $$;
