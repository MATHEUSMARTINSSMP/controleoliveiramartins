-- ============================================================================
-- FIX: Corrigir função gerar_cashback para usar campos corretos
-- Data: 2025-12-15
-- A tabela cashback_transactions usa 'transaction_type' (EARNED/REDEEMED)
-- NÃO usa 'tipo' (CREDITO/DEBITO)
-- ============================================================================

-- ============================================================================
-- PARTE 1: ADICIONAR COLUNAS NECESSÁRIAS
-- ============================================================================

-- Adicionar sale_id se não existir
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE CASCADE;

-- Adicionar colaboradora_id se não existir
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS colaboradora_id UUID REFERENCES sistemaretiradas.profiles(id);

-- Adicionar store_id se não existir (para multi-tenancy)
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sistemaretiradas.stores(id);

-- Índice para buscar por loja
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_store 
ON sistemaretiradas.cashback_transactions(store_id);

-- ============================================================================
-- PARTE 2: FUNÇÃO GERAR_CASHBACK (CORRIGIDA)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback_from_sale(
    p_sale_id UUID
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
    v_prazo_liberacao INTEGER;
    v_prazo_expiracao INTEGER;
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_cashback_ativo BOOLEAN;
    v_existing_transaction UUID;
BEGIN
    -- Buscar dados da venda
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

    -- Verificar se encontrou a venda
    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Venda não encontrada'
        );
    END IF;

    -- Verificar se cliente está identificado
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cliente não identificado (CPF necessário para cashback)'
        );
    END IF;

    -- Verificar se já existe transação para esta venda (evitar duplicatas)
    SELECT id INTO v_existing_transaction
    FROM sistemaretiradas.cashback_transactions
    WHERE sale_id = p_sale_id
    LIMIT 1;

    IF v_existing_transaction IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cashback já gerado para esta venda',
            'existing_transaction_id', v_existing_transaction
        );
    END IF;

    -- Verificar se loja tem cashback ativo
    SELECT cashback_ativo INTO v_cashback_ativo
    FROM sistemaretiradas.stores
    WHERE id = v_store_id;

    IF v_cashback_ativo IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cashback não está ativo para esta loja'
        );
    END IF;

    -- Buscar configurações de cashback (específica da loja ou global)
    SELECT 
        COALESCE(cs.percentual_cashback, 15),
        COALESCE(cs.prazo_liberacao_dias, 2),
        COALESCE(cs.prazo_expiracao_dias, 30)
    INTO 
        v_percentual_cashback,
        v_prazo_liberacao,
        v_prazo_expiracao
    FROM sistemaretiradas.cashback_settings cs
    WHERE cs.store_id = v_store_id OR cs.store_id IS NULL
    ORDER BY cs.store_id NULLS LAST
    LIMIT 1;

    -- Se não houver configuração, usar padrões
    IF v_percentual_cashback IS NULL THEN
        v_percentual_cashback := 15;
        v_prazo_liberacao := 2;
        v_prazo_expiracao := 30;
    END IF;

    -- Calcular cashback (arredondar para cima)
    v_valor_cashback := CEIL((v_valor_venda * v_percentual_cashback / 100));

    -- Calcular datas
    v_data_liberacao := NOW() + (v_prazo_liberacao || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_prazo_expiracao || ' days')::INTERVAL;

    -- Inserir transação com campos CORRETOS
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao,
        sale_id,
        colaboradora_id,
        store_id,
        renovado
    ) VALUES (
        v_cliente_id,
        'EARNED',
        v_valor_cashback,
        'Cashback de compra - Venda #' || LEFT(p_sale_id::TEXT, 8),
        v_data_liberacao,
        v_data_expiracao,
        p_sale_id,
        v_colaboradora_id,
        v_store_id,
        false
    ) RETURNING id INTO v_transaction_id;

    -- Atualizar ou criar saldo do cliente
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        balance,
        balance_disponivel,
        balance_pendente,
        total_earned,
        store_id
    ) VALUES (
        v_cliente_id,
        v_valor_cashback,
        0,
        v_valor_cashback,
        v_valor_cashback,
        v_store_id
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET 
        balance = sistemaretiradas.cashback_balance.balance + v_valor_cashback,
        balance_pendente = sistemaretiradas.cashback_balance.balance_pendente + v_valor_cashback,
        total_earned = sistemaretiradas.cashback_balance.total_earned + v_valor_cashback,
        updated_at = NOW();

    -- Enfileirar notificação WhatsApp se a função existir
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_cashback,
            v_valor_cashback
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignorar se a função não existir
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'valor_cashback', v_valor_cashback,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao
    );
END;
$$;

-- ============================================================================
-- PARTE 3: TRIGGER NA TABELA SALES (CORRIGIDO)
-- ============================================================================

-- Remover trigger antigo
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_sale ON sistemaretiradas.sales;

-- Criar função do trigger
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_new_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Gerar cashback para a nova venda
    v_result := sistemaretiradas.gerar_cashback_from_sale(NEW.id);
    
    -- Log do resultado (opcional, para debug)
    IF (v_result->>'success')::boolean = false THEN
        RAISE NOTICE 'Cashback não gerado para venda %: %', NEW.id, v_result->>'error';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER trg_gerar_cashback_new_sale
AFTER INSERT ON sistemaretiradas.sales
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_new_sale();

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_has_trigger BOOLEAN;
    v_has_function BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_gerar_cashback_new_sale'
    ) INTO v_has_trigger;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'gerar_cashback_from_sale'
        AND pronamespace = 'sistemaretiradas'::regnamespace
    ) INTO v_has_function;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICAÇÃO DO SISTEMA DE CASHBACK (CORRIGIDO)';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Trigger trg_gerar_cashback_new_sale: %', CASE WHEN v_has_trigger THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE 'Função gerar_cashback_from_sale: %', CASE WHEN v_has_function THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE '============================================================';
    
    IF v_has_trigger AND v_has_function THEN
        RAISE NOTICE 'SISTEMA DE CASHBACK CORRIGIDO COM SUCESSO!';
    ELSE
        RAISE EXCEPTION 'ERRO: Algum componente está faltando';
    END IF;
END $$;
