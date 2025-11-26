-- =============================================================================
-- Migration PARTE 3: Criar função para calcular cashback em tiny_orders
-- Data: 2025-01-30
-- Descrição: Função que calcula e aplica cashback automaticamente quando um pedido é criado/atualizado
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- FUNÇÃO: Calcular Cashback para Tiny Order
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_cashback_for_tiny_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_cashback_amount DECIMAL(10,2) := 0;
    v_settings RECORD;
    v_data_liberacao TIMESTAMP;
    v_data_expiracao TIMESTAMP;
    v_balance_id UUID;
    v_current_balance DECIMAL(10,2);
BEGIN
    -- Apenas processar pedidos faturados ou aprovados (situacao = '1' ou '3')
    -- situacao = '1' = Faturado, '3' = Aprovado
    IF NEW.situacao NOT IN ('1', '3') THEN
        RETURN NEW;
    END IF;

    -- ✅ CORREÇÃO: Verificar se é UPDATE e evitar processar novamente
    IF TG_OP = 'UPDATE' THEN
        -- Se já estava faturado/aprovado antes, não processar novamente (evitar duplicação)
        IF OLD.situacao IN ('1', '3') THEN
            RETURN NEW; -- Já foi processado antes
        END IF;
    END IF;

    -- Verificar se tem cliente_id
    IF NEW.cliente_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Verificar se tem valor_total válido
    IF NEW.valor_total IS NULL OR NEW.valor_total <= 0 THEN
        RETURN NEW;
    END IF;

    -- Verificar se cashback_settings existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_settings'
    ) THEN
        RETURN NEW; -- Tabela não existe ainda
    END IF;

    -- Buscar configurações de cashback (primeiro por loja, depois global)
    SELECT * INTO v_settings
    FROM cashback_settings
    WHERE (store_id = NEW.store_id OR store_id IS NULL)
    ORDER BY 
        CASE WHEN store_id = NEW.store_id THEN 0 ELSE 1 END, -- Priorizar configuração da loja
        created_at DESC
    LIMIT 1;

    -- Se não houver configuração, não calcula cashback
    IF v_settings IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calcular cashback baseado no percentual configurado
    v_cashback_amount := (NEW.valor_total * v_settings.percentual_cashback / 100);

    -- Se o cashback for zero ou negativo, não faz nada
    IF v_cashback_amount <= 0 THEN
        RETURN NEW;
    END IF;

    -- Calcular data de liberação (data_pedido + prazo_liberacao_dias)
    IF NEW.data_pedido IS NOT NULL THEN
        v_data_liberacao := NEW.data_pedido + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
        
        -- Calcular data de expiração (data_liberacao + prazo_expiracao_dias)
        v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;
    ELSE
        -- Se não tiver data_pedido, usar NOW()
        v_data_liberacao := NOW() + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;
        v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;
    END IF;

    -- Inserir ou atualizar saldo do cliente
    INSERT INTO cashback_balance (
        cliente_id,
        store_id,
        balance, 
        balance_disponivel,
        balance_pendente,
        total_earned
    )
    VALUES (
        NEW.cliente_id,
        NEW.store_id,
        v_cashback_amount, -- Saldo total (inclui pendente)
        0, -- Ainda não liberado
        v_cashback_amount, -- Pendente até data_liberacao
        v_cashback_amount
    )
    ON CONFLICT ON CONSTRAINT cashback_balance_cliente_unique DO UPDATE
    SET 
        balance = cashback_balance.balance + v_cashback_amount,
        balance_pendente = cashback_balance.balance_pendente + v_cashback_amount,
        total_earned = cashback_balance.total_earned + v_cashback_amount,
        updated_at = NOW()
    WHERE cashback_balance.cliente_id = NEW.cliente_id
    RETURNING id INTO v_balance_id;

    -- Registrar transação
    INSERT INTO cashback_transactions (
        cliente_id,
        tiny_order_id,
        cashback_settings_id,
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        NEW.cliente_id,
        NEW.id,
        v_settings.id,
        'EARNED',
        v_cashback_amount,
        'Cashback de ' || v_settings.percentual_cashback || '% sobre pedido #' || COALESCE(NEW.numero_pedido, NEW.tiny_id) || ' de R$ ' || NEW.valor_total,
        v_data_liberacao,
        v_data_expiracao
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro mas não falhar o trigger
        RAISE WARNING 'Erro ao calcular cashback para pedido %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

COMMENT ON FUNCTION calculate_cashback_for_tiny_order() IS 'Calcula e aplica cashback automaticamente quando um pedido do Tiny ERP é criado/atualizado';

