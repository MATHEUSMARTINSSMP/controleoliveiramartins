-- =============================================================================
-- Migration: Garantir que tabelas de cashback existam antes de adaptá-las
-- Data: 2025-01-30
-- Descrição: Verifica e cria as tabelas base de cashback se não existirem
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. CRIAR cashback_transactions SE NÃO EXISTIR
-- =============================================================================

CREATE TABLE IF NOT EXISTS cashback_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTMENT')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    cashback_rule_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_colaboradora 
    ON cashback_transactions(colaboradora_id) 
    WHERE colaboradora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashback_transactions_sale 
    ON cashback_transactions(sale_id) 
    WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashback_transactions_type 
    ON cashback_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_cashback_transactions_created 
    ON cashback_transactions(created_at DESC);

-- =============================================================================
-- 2. CRIAR cashback_balance SE NÃO EXISTIR
-- =============================================================================

CREATE TABLE IF NOT EXISTS cashback_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaboradora_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
    total_earned DECIMAL(10,2) DEFAULT 0 CHECK (total_earned >= 0),
    total_redeemed DECIMAL(10,2) DEFAULT 0 CHECK (total_redeemed >= 0),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_cashback_balance_colaboradora 
    ON cashback_balance(colaboradora_id) 
    WHERE colaboradora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashback_balance_updated 
    ON cashback_balance(updated_at);

-- Constraint único temporário (será removido na part2 se necessário)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_balance_colaboradora_id_key'
    ) THEN
        -- Tentar criar constraint único se não existir
        -- Mas só se não houver duplicatas
        IF NOT EXISTS (
            SELECT 1 FROM cashback_balance 
            GROUP BY colaboradora_id 
            HAVING COUNT(*) > 1 
            AND colaboradora_id IS NOT NULL
        ) THEN
            ALTER TABLE cashback_balance 
            ADD CONSTRAINT cashback_balance_colaboradora_id_key 
            UNIQUE (colaboradora_id);
        END IF;
    END IF;
EXCEPTION
    WHEN others THEN
        -- Se der erro, não fazer nada (pode já existir ou ter duplicatas)
        NULL;
END $$;

-- =============================================================================
-- 3. CRIAR cashback_settings SE NÃO EXISTIR
-- =============================================================================

CREATE TABLE IF NOT EXISTS cashback_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    prazo_liberacao_dias INTEGER NOT NULL DEFAULT 2 CHECK (prazo_liberacao_dias >= 0),
    prazo_expiracao_dias INTEGER NOT NULL DEFAULT 30 CHECK (prazo_expiracao_dias > 0),
    percentual_cashback DECIMAL(5,2) NOT NULL DEFAULT 15.00 CHECK (percentual_cashback >= 0 AND percentual_cashback <= 100),
    percentual_uso_maximo DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (percentual_uso_maximo >= 0 AND percentual_uso_maximo <= 100),
    renovacao_habilitada BOOLEAN NOT NULL DEFAULT true,
    renovacao_dias INTEGER NOT NULL DEFAULT 3 CHECK (renovacao_dias >= 0),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Constraint único
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cashback_settings_store_id_key'
    ) THEN
        ALTER TABLE cashback_settings 
        ADD CONSTRAINT cashback_settings_store_id_key 
        UNIQUE (store_id);
    END IF;
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_cashback_settings_store 
    ON cashback_settings(store_id) 
    WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashback_settings_global 
    ON cashback_settings(store_id) 
    WHERE store_id IS NULL;

-- =============================================================================
-- 4. HABILITAR RLS (se ainda não estiver habilitado)
-- =============================================================================

ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. CRIAR POLÍTICAS RLS BÁSICAS (se não existirem)
-- =============================================================================

-- Política para cashback_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'cashback_transactions'
        AND policyname = 'admin_cashback_transactions_all'
    ) THEN
        CREATE POLICY "admin_cashback_transactions_all" ON cashback_transactions
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'ADMIN'
                )
            );
    END IF;
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

-- Política para cashback_balance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'cashback_balance'
        AND policyname = 'admin_cashback_balance_all'
    ) THEN
        CREATE POLICY "admin_cashback_balance_all" ON cashback_balance
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'ADMIN'
                )
            );
    END IF;
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

-- Política para cashback_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'cashback_settings'
        AND policyname = 'admin_cashback_settings_all'
    ) THEN
        CREATE POLICY "admin_cashback_settings_all" ON cashback_settings
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'ADMIN'
                )
            );
    END IF;
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

