-- ============================================================================
-- MIGRATION: Refatorar Cashback para usar Tabela Sales
-- Data: 2025-12-12
-- Descrição: Centraliza a geração de cashback na tabela sales, permitindo
--            vendas manuais e de outros ERPs. Remove dependência estrita
--            de tiny_orders e tiny_contacts.
-- ============================================================================

-- 1. Alterar tabela cashback_transactions
-- Adicionar sale_id e remover obrigatoriedade de tiny_order_id
ALTER TABLE sistemaretiradas.cashback_transactions
ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sistemaretiradas.sales(id) ON DELETE CASCADE;

ALTER TABLE sistemaretiradas.cashback_transactions
ALTER COLUMN tiny_order_id DROP NOT NULL;

-- Remover FK estrita de cliente_id (para permitir crm_contacts)
-- Primeiro verificamos se a constraint existe antes de tentar dropar
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

-- 2. Alterar tabela cashback_balance
-- Remover FK estrita de cliente_id (para permitir crm_contacts)
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

-- 3. Atualizar função gerar_cashback
-- Agora aceita sale_id e busca cliente de sales ou tiny_orders
CREATE OR REPLACE FUNCTION sistemaretiradas.gerar_cashback(
    p_sale_id UUID DEFAULT NULL,
    p_tiny_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_cliente_id UUID;
    v_valor_venda NUMERIC(10,2);
    v_data_venda TIMESTAMP WITH TIME ZONE;
    v_config RECORD;
    v_valor_cashback NUMERIC(10,2);
    v_data_liberacao TIMESTAMP WITH TIME ZONE;
    v_data_expiracao TIMESTAMP WITH TIME ZONE;
    v_sale_exists BOOLEAN;
    v_tiny_order_exists BOOLEAN;
    v_result JSONB;
BEGIN
    -- Identificar origem e dados da venda
    IF p_sale_id IS NOT NULL THEN
        SELECT 
            store_id, 
            cliente_id, 
            valor, 
            data_venda,
            tiny_order_id -- Pode estar vinculado
        INTO 
            v_store_id, 
            v_cliente_id, 
            v_valor_venda, 
            v_data_venda,
            p_tiny_order_id -- Atualiza se tiver vínculo
        FROM sistemaretiradas.sales
        WHERE id = p_sale_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Venda não encontrada');
        END IF;
    ELSIF p_tiny_order_id IS NOT NULL THEN
        -- Fallback para compatibilidade (embora devêssemos usar sales agora)
        SELECT 
            store_id, 
            cliente_id, -- Aqui é o ID do tiny_contacts
            valor_total, 
            data_pedido
        INTO 
            v_store_id, 
            v_cliente_id, 
            v_valor_venda, 
            v_data_venda
        FROM sistemaretiradas.tiny_orders
        WHERE id = p_tiny_order_id;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Pedido Tiny não encontrado');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'ID da venda ou pedido não fornecido');
    END IF;

    -- Validar dados essenciais
    IF v_cliente_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Venda sem cliente identificado');
    END IF;

    IF v_valor_venda <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Valor da venda inválido');
    END IF;

    -- Buscar configurações de cashback da loja
    SELECT * INTO v_config
    FROM sistemaretiradas.cashback_settings
    WHERE store_id = v_store_id;

    -- Se não tiver config específica, buscar global
    IF NOT FOUND THEN
        SELECT * INTO v_config
        FROM sistemaretiradas.cashback_settings
        WHERE store_id IS NULL;
    END IF;

    -- Se ainda não tiver config, não gera cashback
    IF v_config IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Configuração de cashback não encontrada');
    END IF;

    -- Verificar se já existe cashback para esta venda (evitar duplicidade)
    -- Verifica por sale_id OU tiny_order_id
    IF EXISTS (
        SELECT 1 FROM sistemaretiradas.cashback_transactions
        WHERE (sale_id = p_sale_id AND p_sale_id IS NOT NULL)
           OR (tiny_order_id = p_tiny_order_id AND p_tiny_order_id IS NOT NULL)
           AND transaction_type = 'EARNED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cashback já gerado para esta venda');
    END IF;

    -- Calcular valores e datas
    v_valor_cashback := ROUND((v_valor_venda * v_config.percentual_cashback / 100.0), 2);
    v_data_liberacao := v_data_venda + (v_config.prazo_liberacao_dias || ' days')::INTERVAL;
    v_data_expiracao := v_data_liberacao + (v_config.prazo_expiracao_dias || ' days')::INTERVAL;

    -- Inserir transação de cashback
    INSERT INTO sistemaretiradas.cashback_transactions (
        cliente_id,
        sale_id,
        tiny_order_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        v_cliente_id,
        p_sale_id,
        p_tiny_order_id,
        'EARNED',
        v_valor_cashback,
        'Cashback referente à venda ' || COALESCE(p_sale_id::text, p_tiny_order_id::text),
        v_data_liberacao,
        v_data_expiracao
    );

    -- Atualizar saldo do cliente (upsert)
    INSERT INTO sistemaretiradas.cashback_balance (
        cliente_id,
        balance,
        balance_pendente,
        total_earned
    ) VALUES (
        v_cliente_id,
        v_valor_cashback, -- Inicialmente vai para pendente ou total? 
                          -- A lógica original somava em balance (total) e pendente
        v_valor_cashback,
        v_valor_cashback
    )
    ON CONFLICT (cliente_id) DO UPDATE
    SET
        balance = cashback_balance.balance + EXCLUDED.balance,
        balance_pendente = cashback_balance.balance_pendente + EXCLUDED.balance_pendente,
        total_earned = cashback_balance.total_earned + EXCLUDED.total_earned,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Cashback gerado com sucesso',
        'valor', v_valor_cashback,
        'liberacao', v_data_liberacao
    );
END;
$$;

-- 4. Criar Trigger na tabela SALES
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_gerar_cashback_venda()
RETURNS TRIGGER AS $$
BEGIN
    -- Tenta gerar cashback (a função trata validações e duplicidade)
    -- Executa de forma assíncrona ou segura para não bloquear a venda em caso de erro?
    -- No Postgres padrão, triggers são síncronos. Vamos apenas chamar e logar erro se houver.
    
    -- Só gera se tiver cliente
    IF NEW.cliente_id IS NOT NULL THEN
        PERFORM sistemaretiradas.gerar_cashback(NEW.id, NEW.tiny_order_id);
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Logar erro mas não impedir a venda
    RAISE WARNING 'Erro ao gerar cashback para venda %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_cashback_new_sale ON sistemaretiradas.sales;

CREATE TRIGGER trg_gerar_cashback_new_sale
AFTER INSERT ON sistemaretiradas.sales
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.trigger_gerar_cashback_venda();

-- 5. Remover Trigger antigo da tabela tiny_orders (para evitar duplicidade e centralizar)
DROP TRIGGER IF EXISTS trg_gerar_cashback_new_order ON sistemaretiradas.tiny_orders;

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================
