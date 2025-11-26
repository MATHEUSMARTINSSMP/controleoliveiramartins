-- =============================================================================
-- Migration: Adaptar Sistema de Cashback para Clientes (Tiny Orders)
-- Data: 2025-01-30
-- Descrição: Adapta o sistema de cashback para funcionar com clientes do Tiny ERP
--            Adiciona suporte para cashback gerado automaticamente em tiny_orders
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. ADAPTAR cashback_transactions PARA SUPORTAR CLIENTES
-- =============================================================================

-- Verificar se a tabela existe antes de alterar
DO $$
BEGIN
    -- Verificar se a tabela cashback_transactions existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        -- Adicionar cliente_id (FK para tiny_contacts)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'cliente_id'
        ) THEN
            ALTER TABLE cashback_transactions 
            ADD COLUMN cliente_id UUID REFERENCES tiny_contacts(id) ON DELETE CASCADE;
            
            COMMENT ON COLUMN cashback_transactions.cliente_id IS 'FK para tiny_contacts - Cliente que ganhou cashback (para vendas do Tiny ERP)';
        END IF;

        -- Adicionar tiny_order_id (FK para tiny_orders)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'tiny_order_id'
        ) THEN
            -- Verificar se tiny_orders existe antes de criar FK
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'sistemaretiradas' 
                AND table_name = 'tiny_orders'
            ) THEN
                ALTER TABLE cashback_transactions 
                ADD COLUMN tiny_order_id UUID REFERENCES tiny_orders(id) ON DELETE SET NULL;
                
                COMMENT ON COLUMN cashback_transactions.tiny_order_id IS 'FK para tiny_orders - Pedido do Tiny ERP que gerou cashback';
            END IF;
        END IF;

        -- Tornar colaboradora_id opcional (agora pode ser cliente OU colaboradora)
        -- Não precisamos alterar a coluna, apenas o comentário
        COMMENT ON COLUMN cashback_transactions.colaboradora_id IS 'FK para profiles - Colaboradora que ganhou cashback (para vendas internas). NULL se for cliente.';
    END IF; -- Fim da verificação de existência da tabela
END $$;

-- Criar índices para os novos campos (apenas se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_cliente_id 
            ON cashback_transactions(cliente_id) 
            WHERE cliente_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_tiny_order_id 
            ON cashback_transactions(tiny_order_id) 
            WHERE tiny_order_id IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- 2. ADAPTAR cashback_balance PARA SUPORTAR CLIENTES
-- =============================================================================

-- Verificar se a tabela existe antes de alterar
DO $$
BEGIN
    -- Verificar se a tabela cashback_balance existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        -- Adicionar cliente_id (FK para tiny_contacts)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'cliente_id'
        ) THEN
            -- Verificar se tiny_contacts existe antes de criar FK
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'sistemaretiradas' 
                AND table_name = 'tiny_contacts'
            ) THEN
                ALTER TABLE cashback_balance 
                ADD COLUMN cliente_id UUID REFERENCES tiny_contacts(id) ON DELETE CASCADE;
                
                COMMENT ON COLUMN cashback_balance.cliente_id IS 'FK para tiny_contacts - Cliente com saldo de cashback (para vendas do Tiny ERP)';
            END IF;
        END IF;

    -- Tornar colaboradora_id opcional
    -- Remover constraint UNIQUE se existir e criar nova que permite NULL
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_balance_colaboradora_id_key'
    ) THEN
        ALTER TABLE cashback_balance 
        DROP CONSTRAINT cashback_balance_colaboradora_id_key;
    END IF;

    -- Criar constraint: apenas um pode ser NOT NULL
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_balance_owner_check'
    ) THEN
        ALTER TABLE cashback_balance 
        ADD CONSTRAINT cashback_balance_owner_check 
        CHECK (
            (colaboradora_id IS NOT NULL AND cliente_id IS NULL) OR
            (colaboradora_id IS NULL AND cliente_id IS NOT NULL)
        );
        
        COMMENT ON CONSTRAINT cashback_balance_owner_check ON cashback_balance 
        IS 'Garante que cada registro tem OU colaboradora_id OU cliente_id, nunca ambos ou nenhum';
    END IF;
    
        -- Atualizar comentário da coluna colaboradora_id
        COMMENT ON COLUMN cashback_balance.colaboradora_id IS 'FK para profiles - Colaboradora com saldo (para vendas internas). NULL se for cliente.';
    END IF; -- Fim da verificação de existência da tabela
END $$;

-- Criar índices únicos parciais para garantir unicidade (apenas se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS cashback_balance_colaboradora_unique 
            ON cashback_balance(colaboradora_id) 
            WHERE colaboradora_id IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS cashback_balance_cliente_unique 
            ON cashback_balance(cliente_id) 
            WHERE cliente_id IS NOT NULL;

        -- Criar índice para cliente_id
        CREATE INDEX IF NOT EXISTS idx_cashback_balance_cliente_id 
            ON cashback_balance(cliente_id) 
            WHERE cliente_id IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- 3. FUNÇÃO: Calcular Cashback para Tiny Order
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

    -- ✅ CORREÇÃO: Verificar se é UPDATE e se a situação mudou para faturado/aprovado
    -- Se for UPDATE e já estava faturado/aprovado, não processar novamente (evitar duplicação)
    IF TG_OP = 'UPDATE' THEN
        -- Se já estava faturado/aprovado antes, não processar novamente
        IF OLD.situacao IN ('1', '3') AND NEW.situacao IN ('1', '3') THEN
            RETURN NEW; -- Já foi processado antes
        END IF;
        -- Se mudou de não-faturado para faturado/aprovado, processar
        IF OLD.situacao NOT IN ('1', '3') AND NEW.situacao IN ('1', '3') THEN
            -- Continuar processamento abaixo
        ELSE
            RETURN NEW; -- Não mudou para faturado/aprovado
        END IF;
    END IF;
    -- Se for INSERT e está faturado/aprovado, processar normalmente

    -- Verificar se tem cliente_id
    IF NEW.cliente_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Verificar se tem valor_total válido
    IF NEW.valor_total IS NULL OR NEW.valor_total <= 0 THEN
        RETURN NEW;
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
    v_data_liberacao := NEW.data_pedido + (v_settings.prazo_liberacao_dias || ' days')::INTERVAL;

    -- Calcular data de expiração (data_liberacao + prazo_expiracao_dias)
    v_data_expiracao := v_data_liberacao + (v_settings.prazo_expiracao_dias || ' days')::INTERVAL;

    -- Inserir ou atualizar saldo do cliente
    INSERT INTO cashback_balance (
        cliente_id, 
        balance, 
        balance_disponivel,
        balance_pendente,
        total_earned
    )
    VALUES (
        NEW.cliente_id, 
        v_cashback_amount, -- Saldo total (inclui pendente)
        0, -- Ainda não liberado
        v_cashback_amount, -- Pendente até data_liberacao
        v_cashback_amount
    )
    ON CONFLICT (cliente_id) DO UPDATE
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
        transaction_type,
        amount,
        description,
        data_liberacao,
        data_expiracao
    ) VALUES (
        NEW.cliente_id,
        NEW.id,
        'EARNED',
        v_cashback_amount,
        'Cashback de ' || v_settings.percentual_cashback || '% sobre pedido #' || COALESCE(NEW.numero_pedido, NEW.tiny_id) || ' de R$ ' || NEW.valor_total,
        v_data_liberacao,
        v_data_expiracao
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION calculate_cashback_for_tiny_order() IS 'Calcula e aplica cashback automaticamente quando um pedido do Tiny ERP é criado/atualizado';

-- =============================================================================
-- 4. TRIGGER: Disparar cálculo de cashback em tiny_orders
-- =============================================================================

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS trigger_calculate_cashback_tiny_order ON tiny_orders;

-- Criar trigger após INSERT ou UPDATE (se situacao mudou para faturado/aprovado)
-- NOTA: TG_OP não pode ser usado na cláusula WHEN, então verificamos dentro da função
CREATE TRIGGER trigger_calculate_cashback_tiny_order
    AFTER INSERT OR UPDATE ON tiny_orders
    FOR EACH ROW
    WHEN (
        NEW.valor_total > 0 
        AND NEW.cliente_id IS NOT NULL
        AND NEW.situacao IN ('1', '3') -- Faturado ou Aprovado
    )
    EXECUTE FUNCTION calculate_cashback_for_tiny_order();

-- =============================================================================
-- 5. FUNÇÃO: Atualizar saldos quando cashback é liberado
-- =============================================================================

-- Função para mover cashback de pendente para disponível quando data_liberacao chega
CREATE OR REPLACE FUNCTION update_cashback_balances_on_liberation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
BEGIN
    -- Atualizar saldos: mover de pendente para disponível
    UPDATE cashback_balance cb
    SET 
        balance_disponivel = balance_disponivel + (
            SELECT COALESCE(SUM(ct.amount), 0)
            FROM cashback_transactions ct
            WHERE ct.cliente_id = cb.cliente_id
            AND ct.transaction_type = 'EARNED'
            AND ct.data_liberacao <= NOW()
            AND ct.data_liberacao > cb.updated_at -- Apenas novos liberados
        ),
        balance_pendente = balance_pendente - (
            SELECT COALESCE(SUM(ct.amount), 0)
            FROM cashback_transactions ct
            WHERE ct.cliente_id = cb.cliente_id
            AND ct.transaction_type = 'EARNED'
            AND ct.data_liberacao <= NOW()
            AND ct.data_liberacao > cb.updated_at
        ),
        updated_at = NOW()
    WHERE cb.cliente_id IS NOT NULL
    AND EXISTS (
        SELECT 1
        FROM cashback_transactions ct
        WHERE ct.cliente_id = cb.cliente_id
        AND ct.transaction_type = 'EARNED'
        AND ct.data_liberacao <= NOW()
        AND ct.data_liberacao > cb.updated_at
    );
END;
$$;

COMMENT ON FUNCTION update_cashback_balances_on_liberation() IS 'Atualiza saldos de cashback quando data_liberacao chega (mover de pendente para disponível)';

-- =============================================================================
-- 6. FUNÇÃO: Renovar Cashback
-- =============================================================================

CREATE OR REPLACE FUNCTION renovar_cashback(
    p_transaction_id UUID,
    p_cliente_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sistemaretiradas, public
AS $$
DECLARE
    v_transaction RECORD;
    v_settings RECORD;
    v_nova_data_expiracao TIMESTAMP;
    v_result JSON;
BEGIN
    -- Buscar transação
    SELECT * INTO v_transaction
    FROM cashback_transactions
    WHERE id = p_transaction_id
    AND transaction_type = 'EARNED'
    AND (p_cliente_id IS NULL OR cliente_id = p_cliente_id);

    IF v_transaction IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Transação não encontrada ou inválida'
        );
    END IF;

    -- Buscar configurações
    SELECT * INTO v_settings
    FROM cashback_settings
    WHERE renovacao_habilitada = true
    AND (store_id = (SELECT store_id FROM tiny_contacts WHERE id = v_transaction.cliente_id) OR store_id IS NULL)
    ORDER BY 
        CASE WHEN store_id = (SELECT store_id FROM tiny_contacts WHERE id = v_transaction.cliente_id) THEN 0 ELSE 1 END,
        created_at DESC
    LIMIT 1;

    IF v_settings IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Renovação de cashback não está habilitada'
        );
    END IF;

    -- Calcular nova data de expiração
    v_nova_data_expiracao := COALESCE(v_transaction.data_expiracao, NOW()) + (v_settings.renovacao_dias || ' days')::INTERVAL;

    -- Atualizar transação
    UPDATE cashback_transactions
    SET 
        data_expiracao = v_nova_data_expiracao,
        renovado = true,
        recuperado = true -- Renovação manual
    WHERE id = p_transaction_id;

    RETURN json_build_object(
        'success', true,
        'nova_data_expiracao', v_nova_data_expiracao,
        'message', 'Cashback renovado com sucesso por mais ' || v_settings.renovacao_dias || ' dias'
    );
END;
$$;

COMMENT ON FUNCTION renovar_cashback(UUID, UUID) IS 'Renova o prazo de expiração de um cashback específico';

-- =============================================================================
-- 7. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =============================================================================

-- Índice composto para buscar cashback por cliente e status
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_cliente_status 
    ON cashback_transactions(cliente_id, transaction_type, data_expiracao) 
    WHERE cliente_id IS NOT NULL;

-- Índice para buscar cashback expirando (próximos 7 dias)
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_expirando 
    ON cashback_transactions(data_expiracao) 
    WHERE data_expiracao IS NOT NULL 
    AND data_expiracao BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    AND transaction_type = 'EARNED';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

