-- =============================================================================
-- Migration PARTE 2: Adaptar cashback_balance para suportar clientes
-- Data: 2025-01-30
-- Descrição: Adiciona campo cliente_id, balance_disponivel, balance_pendente em cashback_balance
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. VERIFICAR E CRIAR CAMPOS EM cashback_balance
-- =============================================================================

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

        -- Adicionar store_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'store_id'
        ) THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'sistemaretiradas' 
                AND table_name = 'stores'
            ) THEN
                ALTER TABLE cashback_balance 
                ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
                
                COMMENT ON COLUMN cashback_balance.store_id IS 'FK para stores - Loja associada ao cashback';
            END IF;
        END IF;

        -- Adicionar balance_disponivel
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_disponivel'
        ) THEN
            ALTER TABLE cashback_balance 
            ADD COLUMN balance_disponivel DECIMAL(10,2) DEFAULT 0 CHECK (balance_disponivel >= 0);
            
            COMMENT ON COLUMN cashback_balance.balance_disponivel IS 'Saldo de cashback disponível para uso (liberado e não expirado)';
        END IF;

        -- Adicionar balance_pendente
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_pendente'
        ) THEN
            ALTER TABLE cashback_balance 
            ADD COLUMN balance_pendente DECIMAL(10,2) DEFAULT 0 CHECK (balance_pendente >= 0);
            
            COMMENT ON COLUMN cashback_balance.balance_pendente IS 'Saldo de cashback pendente de liberação';
        END IF;

        -- Adicionar campos de expiração
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'data_expiracao_proximo'
        ) THEN
            ALTER TABLE cashback_balance 
            ADD COLUMN data_expiracao_proximo TIMESTAMP;
            
            COMMENT ON COLUMN cashback_balance.data_expiracao_proximo IS 'Data de expiração do próximo cashback a expirar';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'valor_expiracao_proximo'
        ) THEN
            ALTER TABLE cashback_balance 
            ADD COLUMN valor_expiracao_proximo DECIMAL(10,2) DEFAULT 0;
            
            COMMENT ON COLUMN cashback_balance.valor_expiracao_proximo IS 'Valor do próximo cashback a expirar';
        END IF;

        -- Remover constraint UNIQUE antiga em colaboradora_id se existir
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'cashback_balance_colaboradora_id_key'
            AND conrelid = 'sistemaretiradas.cashback_balance'::regclass
        ) THEN
            ALTER TABLE cashback_balance 
            DROP CONSTRAINT cashback_balance_colaboradora_id_key;
        END IF;

        -- Criar constraint: apenas um pode ser NOT NULL
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'cashback_balance_owner_check'
            AND conrelid = 'sistemaretiradas.cashback_balance'::regclass
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
    END IF;
END $$;

-- =============================================================================
-- 2. CRIAR ÍNDICES ÚNICOS PARCIAIS
-- =============================================================================

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

        CREATE INDEX IF NOT EXISTS idx_cashback_balance_cliente_id 
            ON cashback_balance(cliente_id) 
            WHERE cliente_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_cashback_balance_store_id 
            ON cashback_balance(store_id) 
            WHERE store_id IS NOT NULL;
    END IF;
END $$;

