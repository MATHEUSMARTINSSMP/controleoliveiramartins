-- ============================================================================
-- FIX: Corrigir função enqueue_cashback_whatsapp para incluir store_id
-- Data: 2025-12-15
-- Problema: A função não estava recebendo/salvando store_id, necessário para
--           a Netlify Function buscar credenciais de WhatsApp da loja
-- ============================================================================

-- ============================================================================
-- PARTE 1: GARANTIR QUE A TABELA TEM TODAS AS COLUNAS NECESSÁRIAS
-- ============================================================================

DO $$
BEGIN
    -- Adicionar store_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'store_id'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE;
    END IF;

    -- Adicionar transaction_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'transaction_id'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN transaction_id UUID REFERENCES sistemaretiradas.cashback_transactions(id) ON DELETE CASCADE;
    END IF;

    -- Adicionar cliente_nome se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'cliente_nome'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN cliente_nome TEXT;
    END IF;

    -- Adicionar cliente_telefone se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'cliente_telefone'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN cliente_telefone TEXT;
    END IF;

    -- Adicionar valor_cashback se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'valor_cashback'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN valor_cashback NUMERIC(10,2);
    END IF;

    -- Adicionar saldo_total se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_whatsapp_queue'
        AND column_name = 'saldo_total'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_whatsapp_queue 
        ADD COLUMN saldo_total NUMERIC(10,2);
    END IF;
END $$;

-- Índice para store_id
CREATE INDEX IF NOT EXISTS idx_cashback_whatsapp_queue_store 
ON sistemaretiradas.cashback_whatsapp_queue(store_id);

-- ============================================================================
-- PARTE 2: FUNÇÃO ENQUEUE CORRIGIDA (COM STORE_ID)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.enqueue_cashback_whatsapp(
    p_cliente_id UUID,
    p_cliente_nome TEXT,
    p_cliente_telefone TEXT,
    p_valor_cashback NUMERIC,
    p_saldo_total NUMERIC,
    p_store_id UUID DEFAULT NULL,
    p_transaction_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se não tem telefone, não enfileirar
    IF p_cliente_telefone IS NULL OR p_cliente_telefone = '' THEN
        RAISE NOTICE 'Cliente sem telefone, WhatsApp não enfileirado';
        RETURN;
    END IF;

    INSERT INTO sistemaretiradas.cashback_whatsapp_queue (
        cliente_id,
        cliente_nome,
        cliente_telefone,
        valor_cashback,
        saldo_total,
        store_id,
        transaction_id,
        status
    ) VALUES (
        p_cliente_id,
        p_cliente_nome,
        p_cliente_telefone,
        p_valor_cashback,
        p_saldo_total,
        p_store_id,
        p_transaction_id,
        'PENDING'
    );
    
    RAISE NOTICE 'WhatsApp de cashback enfileirado para % (tel: %, loja: %)', p_cliente_nome, p_cliente_telefone, p_store_id;
END;
$$;

-- ============================================================================
-- PARTE 3: ATUALIZAR FUNÇÃO gerar_cashback_from_sale PARA PASSAR STORE_ID
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
    v_saldo_total NUMERIC;
BEGIN
    -- Buscar dados da venda
    SELECT 
        COALESCE(s.cliente_id, s.tiny_contact_id),
        COALESCE(s.cliente_nome, tc.nome, cc.nome),
        COALESCE(s.cliente_telefone, tc.telefone, cc.telefone),
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
    LEFT JOIN sistemaretiradas.crm_contacts cc ON cc.id = s.cliente_id
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

    -- Inserir transação
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
        updated_at = NOW()
    RETURNING balance INTO v_saldo_total;

    -- ✅ CORRIGIDO: Enfileirar notificação WhatsApp COM store_id e transaction_id
    BEGIN
        PERFORM sistemaretiradas.enqueue_cashback_whatsapp(
            v_cliente_id,
            v_cliente_nome,
            v_cliente_telefone,
            v_valor_cashback,
            v_saldo_total,
            v_store_id,        -- ✅ AGORA PASSA STORE_ID
            v_transaction_id   -- ✅ AGORA PASSA TRANSACTION_ID
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao enfileirar WhatsApp: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'valor_cashback', v_valor_cashback,
        'data_liberacao', v_data_liberacao,
        'data_expiracao', v_data_expiracao,
        'cliente_telefone', v_cliente_telefone,
        'store_id', v_store_id
    );
END;
$$;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

DO $$
DECLARE
    v_columns TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns
    WHERE table_schema = 'sistemaretiradas'
    AND table_name = 'cashback_whatsapp_queue';

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICAÇÃO DA TABELA cashback_whatsapp_queue';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Colunas: %', v_columns;
    RAISE NOTICE '============================================================';
END $$;
