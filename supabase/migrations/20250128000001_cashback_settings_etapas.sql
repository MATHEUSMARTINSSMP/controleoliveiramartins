-- =============================================================================
-- CONFIGURAÇÕES DE CASHBACK - EXECUTAR EM ETAPAS
-- =============================================================================
-- ETAPA 1: Criar tabela cashback_settings
-- ETAPA 2: Adicionar campos em cashback_transactions (se existir)
-- ETAPA 3: Adicionar campos em cashback_balance (se existir)
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- ETAPA 1: Criar tabela cashback_settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS cashback_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- NULL = configuração global
    -- Prazo para poder usar o cashback (em dias)
    prazo_liberacao_dias INTEGER NOT NULL DEFAULT 2 CHECK (prazo_liberacao_dias >= 0),
    -- Prazo para expirar o cashback gerado (em dias após liberação)
    prazo_expiracao_dias INTEGER NOT NULL DEFAULT 30 CHECK (prazo_expiracao_dias > 0),
    -- % de cashback gerado em cada compra
    percentual_cashback DECIMAL(5,2) NOT NULL DEFAULT 15.00 CHECK (percentual_cashback >= 0 AND percentual_cashback <= 100),
    -- % da próxima compra que pode utilizar o cashback
    percentual_uso_maximo DECIMAL(5,2) NOT NULL DEFAULT 30.00 CHECK (percentual_uso_maximo >= 0 AND percentual_uso_maximo <= 100),
    -- Função renovar cashback: habilitada ou não
    renovacao_habilitada BOOLEAN NOT NULL DEFAULT true,
    -- Quantos dias renovar o cashback quando renovado
    renovacao_dias INTEGER NOT NULL DEFAULT 3 CHECK (renovacao_dias >= 0),
    -- Observações/descrição
    observacoes TEXT,
    -- Metadados
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Apenas uma configuração por loja (ou global se store_id for NULL)
    UNIQUE(store_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cashback_settings_store ON cashback_settings(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashback_settings_global ON cashback_settings(store_id) WHERE store_id IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cashback_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_cashback_settings_updated_at ON cashback_settings;
CREATE TRIGGER trigger_update_cashback_settings_updated_at
    BEFORE UPDATE ON cashback_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_cashback_settings_updated_at();

-- Comentários
COMMENT ON TABLE cashback_settings IS 'Configurações de regras de cashback (global ou por loja)';
COMMENT ON COLUMN cashback_settings.store_id IS 'NULL = configuração global, UUID = configuração específica da loja';
COMMENT ON COLUMN cashback_settings.prazo_liberacao_dias IS 'Dias após a compra para o cashback ficar disponível para uso';
COMMENT ON COLUMN cashback_settings.prazo_expiracao_dias IS 'Dias após a liberação para o cashback expirar';
COMMENT ON COLUMN cashback_settings.percentual_cashback IS 'Percentual de cashback gerado em cada compra (ex: 15.00 = 15%)';
COMMENT ON COLUMN cashback_settings.percentual_uso_maximo IS 'Percentual máximo da compra que pode ser pago com cashback (ex: 30.00 = 30%)';
COMMENT ON COLUMN cashback_settings.renovacao_habilitada IS 'Se true, permite renovar cashback por mais dias';
COMMENT ON COLUMN cashback_settings.renovacao_dias IS 'Quantos dias adicionar ao prazo quando renovar cashback';

-- RLS
ALTER TABLE cashback_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_cashback_settings_all" ON cashback_settings;
CREATE POLICY "admin_cashback_settings_all" ON cashback_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Dados iniciais (configuração padrão global)
INSERT INTO cashback_settings (
    store_id,
    prazo_liberacao_dias,
    prazo_expiracao_dias,
    percentual_cashback,
    percentual_uso_maximo,
    renovacao_habilitada,
    renovacao_dias,
    observacoes
) VALUES (
    NULL, -- Configuração global
    2,    -- 2 dias para liberar
    30,   -- 30 dias para expirar após liberação
    15.00, -- 15% de cashback
    30.00, -- 30% máximo de uso na compra
    true,  -- Renovação habilitada
    3,     -- 3 dias de renovação
    'Configuração padrão do sistema de cashback'
)
ON CONFLICT (store_id) DO NOTHING;

-- =============================================================================
-- ETAPA 2: Adicionar campos em cashback_transactions (SE A TABELA EXISTIR)
-- =============================================================================

DO $$
BEGIN
    -- Verificar se a tabela cashback_transactions existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        -- Campo renovado
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'renovado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN renovado BOOLEAN DEFAULT false;
            COMMENT ON COLUMN cashback_transactions.renovado IS 'Indica se o cashback foi renovado automaticamente';
        END IF;

        -- Campo recuperado
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'recuperado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN recuperado BOOLEAN DEFAULT false;
            COMMENT ON COLUMN cashback_transactions.recuperado IS 'Indica se o cashback foi recuperado/renovado a pedido do cliente';
        END IF;

        -- Campo data_expiracao
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_expiracao'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN data_expiracao TIMESTAMP;
            COMMENT ON COLUMN cashback_transactions.data_expiracao IS 'Data em que o cashback expira';
        END IF;

        -- Campo data_liberacao
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_liberacao'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN data_liberacao TIMESTAMP;
            COMMENT ON COLUMN cashback_transactions.data_liberacao IS 'Data em que o cashback fica disponível para uso';
        END IF;

        -- Criar índices
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_renovado ON cashback_transactions(renovado) WHERE renovado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_recuperado ON cashback_transactions(recuperado) WHERE recuperado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_expiracao ON cashback_transactions(data_expiracao) WHERE data_expiracao IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_liberacao ON cashback_transactions(data_liberacao) WHERE data_liberacao IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- ETAPA 3: Adicionar campos em cashback_balance (SE A TABELA EXISTIR)
-- =============================================================================

DO $$
BEGIN
    -- Verificar se a tabela cashback_balance existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        -- Campo balance_disponivel
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_disponivel'
        ) THEN
            ALTER TABLE cashback_balance ADD COLUMN balance_disponivel DECIMAL(10,2) DEFAULT 0 CHECK (balance_disponivel >= 0);
            COMMENT ON COLUMN cashback_balance.balance_disponivel IS 'Saldo de cashback disponível para uso (liberado e não expirado)';
        END IF;

        -- Campo balance_pendente
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_pendente'
        ) THEN
            ALTER TABLE cashback_balance ADD COLUMN balance_pendente DECIMAL(10,2) DEFAULT 0 CHECK (balance_pendente >= 0);
            COMMENT ON COLUMN cashback_balance.balance_pendente IS 'Saldo de cashback pendente de liberação';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

