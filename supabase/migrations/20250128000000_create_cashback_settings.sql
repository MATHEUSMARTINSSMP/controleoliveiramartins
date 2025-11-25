-- =============================================================================
-- CONFIGURAÇÕES DE CASHBACK
-- =============================================================================
-- Tabela para armazenar as regras e configurações do sistema de cashback
-- Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Tabela de configurações de cashback (uma configuração global ou por loja)
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

-- Comentários
COMMENT ON TABLE cashback_settings IS 'Configurações de regras de cashback (global ou por loja)';
COMMENT ON COLUMN cashback_settings.store_id IS 'NULL = configuração global, UUID = configuração específica da loja';
COMMENT ON COLUMN cashback_settings.prazo_liberacao_dias IS 'Dias após a compra para o cashback ficar disponível para uso';
COMMENT ON COLUMN cashback_settings.prazo_expiracao_dias IS 'Dias após a liberação para o cashback expirar';
COMMENT ON COLUMN cashback_settings.percentual_cashback IS 'Percentual de cashback gerado em cada compra (ex: 15.00 = 15%)';
COMMENT ON COLUMN cashback_settings.percentual_uso_maximo IS 'Percentual máximo da compra que pode ser pago com cashback (ex: 30.00 = 30%)';
COMMENT ON COLUMN cashback_settings.renovacao_habilitada IS 'Se true, permite renovar cashback por mais dias';
COMMENT ON COLUMN cashback_settings.renovacao_dias IS 'Quantos dias adicionar ao prazo quando renovar cashback';

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

CREATE TRIGGER trigger_update_cashback_settings_updated_at
    BEFORE UPDATE ON cashback_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_cashback_settings_updated_at();

-- =============================================================================
-- ATUALIZAR TABELA cashback_transactions (ETAPA 1: Verificar se tabela existe)
-- =============================================================================
-- Adicionar campos para rastrear renovações e recuperações

-- Verificar se a tabela cashback_transactions existe antes de alterar
DO $$
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        -- Campo para marcar se o cashback foi renovado
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'renovado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN renovado BOOLEAN DEFAULT false;
        END IF;

        -- Campo para marcar se o cashback foi recuperado (renovação a pedido do cliente)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'recuperado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN recuperado BOOLEAN DEFAULT false;
        END IF;

        -- Campo para data de expiração do cashback
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_expiracao'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN data_expiracao TIMESTAMP;
        END IF;

        -- Campo para data de liberação (quando o cashback fica disponível para uso)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_liberacao'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN data_liberacao TIMESTAMP;
        END IF;
    END IF;
END $$;

-- Índices para os novos campos (apenas se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_renovado ON cashback_transactions(renovado) WHERE renovado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_recuperado ON cashback_transactions(recuperado) WHERE recuperado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_expiracao ON cashback_transactions(data_expiracao) WHERE data_expiracao IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_liberacao ON cashback_transactions(data_liberacao) WHERE data_liberacao IS NOT NULL;
    END IF;
END $$;

-- Comentários (apenas se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'renovado'
        ) THEN
            COMMENT ON COLUMN cashback_transactions.renovado IS 'Indica se o cashback foi renovado automaticamente';
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'recuperado'
        ) THEN
            COMMENT ON COLUMN cashback_transactions.recuperado IS 'Indica se o cashback foi recuperado/renovado a pedido do cliente';
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_expiracao'
        ) THEN
            COMMENT ON COLUMN cashback_transactions.data_expiracao IS 'Data em que o cashback expira';
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_liberacao'
        ) THEN
            COMMENT ON COLUMN cashback_transactions.data_liberacao IS 'Data em que o cashback fica disponível para uso';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- ATUALIZAR TABELA cashback_balance (ETAPA 2: Verificar se tabela existe)
-- =============================================================================
-- Adicionar campos para rastrear saldo disponível vs pendente

DO $$
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        -- Saldo disponível (já liberado e não expirado)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_disponivel'
        ) THEN
            ALTER TABLE cashback_balance ADD COLUMN balance_disponivel DECIMAL(10,2) DEFAULT 0 CHECK (balance_disponivel >= 0);
        END IF;

        -- Saldo pendente (ainda não liberado)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_pendente'
        ) THEN
            ALTER TABLE cashback_balance ADD COLUMN balance_pendente DECIMAL(10,2) DEFAULT 0 CHECK (balance_pendente >= 0);
        END IF;
    END IF;
END $$;

-- Comentários (apenas se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_disponivel'
        ) THEN
            COMMENT ON COLUMN cashback_balance.balance_disponivel IS 'Saldo de cashback disponível para uso (liberado e não expirado)';
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_balance' 
            AND column_name = 'balance_pendente'
        ) THEN
            COMMENT ON COLUMN cashback_balance.balance_pendente IS 'Saldo de cashback pendente de liberação';
        END IF;
    END IF;
END $$;

-- =============================================================================
-- RLS (Row Level Security)
-- =============================================================================

ALTER TABLE cashback_settings ENABLE ROW LEVEL SECURITY;

-- Apenas ADMIN pode gerenciar configurações
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

-- =============================================================================
-- DADOS INICIAIS (Configuração padrão global)
-- =============================================================================

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
-- FIM DA MIGRATION
-- =============================================================================

