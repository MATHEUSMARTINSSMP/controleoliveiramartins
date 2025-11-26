-- =============================================================================
-- Migration PARTE 1: Adaptar cashback_transactions para suportar clientes
-- Data: 2025-01-30
-- Descrição: Adiciona campos cliente_id e tiny_order_id em cashback_transactions
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. VERIFICAR E CRIAR CAMPOS EM cashback_transactions
-- =============================================================================

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
            -- Verificar se tiny_contacts existe antes de criar FK
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'sistemaretiradas' 
                AND table_name = 'tiny_contacts'
            ) THEN
                ALTER TABLE cashback_transactions 
                ADD COLUMN cliente_id UUID REFERENCES tiny_contacts(id) ON DELETE CASCADE;
                
                COMMENT ON COLUMN cashback_transactions.cliente_id IS 'FK para tiny_contacts - Cliente que ganhou cashback (para vendas do Tiny ERP)';
            END IF;
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

        -- Adicionar campos de data se não existirem
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_liberacao'
        ) THEN
            ALTER TABLE cashback_transactions 
            ADD COLUMN data_liberacao TIMESTAMP;
            
            COMMENT ON COLUMN cashback_transactions.data_liberacao IS 'Data em que o cashback fica disponível para uso';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_expiracao'
        ) THEN
            ALTER TABLE cashback_transactions 
            ADD COLUMN data_expiracao TIMESTAMP;
            
            COMMENT ON COLUMN cashback_transactions.data_expiracao IS 'Data em que o cashback expira';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'renovado'
        ) THEN
            ALTER TABLE cashback_transactions 
            ADD COLUMN renovado BOOLEAN DEFAULT false;
            
            COMMENT ON COLUMN cashback_transactions.renovado IS 'Indica se o cashback foi renovado';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'recuperado'
        ) THEN
            ALTER TABLE cashback_transactions 
            ADD COLUMN recuperado BOOLEAN DEFAULT false;
            
            COMMENT ON COLUMN cashback_transactions.recuperado IS 'Indica se o cashback foi recuperado/renovado a pedido do cliente';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'cashback_settings_id'
        ) THEN
            -- Verificar se cashback_settings existe antes de criar FK
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'sistemaretiradas' 
                AND table_name = 'cashback_settings'
            ) THEN
                ALTER TABLE cashback_transactions 
                ADD COLUMN cashback_settings_id UUID REFERENCES cashback_settings(id) ON DELETE SET NULL;
                
                COMMENT ON COLUMN cashback_transactions.cashback_settings_id IS 'FK para cashback_settings - Regra que gerou este cashback';
            END IF;
        END IF;

        -- Atualizar comentário da coluna colaboradora_id
        COMMENT ON COLUMN cashback_transactions.colaboradora_id IS 'FK para profiles - Colaboradora que ganhou cashback (para vendas internas). NULL se for cliente.';
    END IF;
END $$;

-- =============================================================================
-- 2. CRIAR ÍNDICES
-- =============================================================================

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

        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_cliente_status 
            ON cashback_transactions(cliente_id, transaction_type, data_expiracao) 
            WHERE cliente_id IS NOT NULL;

        -- ✅ CORREÇÃO: Não podemos usar NOW() em índices (não é IMMUTABLE)
        -- Criar índice simples em data_expiracao e transaction_type
        -- A query de busca por expirando será feita com NOW() na query, não no índice
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_expirando 
            ON cashback_transactions(data_expiracao, transaction_type) 
            WHERE data_expiracao IS NOT NULL 
            AND transaction_type = 'EARNED';
    END IF;
END $$;

