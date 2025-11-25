-- =============================================================================
-- VERIFICAÇÃO COMPLETA DO SISTEMA - SUPABASE
-- =============================================================================
-- Este script verifica e cria TODAS as estruturas necessárias para o sistema
-- funcionar 100%. Execute em etapas se necessário.
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- ETAPA 1: Verificar e criar tabelas principais (se não existirem)
-- =============================================================================

-- Tabela: profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'profiles'
    ) THEN
        RAISE EXCEPTION 'Tabela profiles não existe! Execute as migrations iniciais primeiro.';
    END IF;
END $$;

-- Tabela: stores
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'stores'
    ) THEN
        RAISE EXCEPTION 'Tabela stores não existe! Execute as migrations iniciais primeiro.';
    END IF;
END $$;

-- Tabela: goals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'goals'
    ) THEN
        RAISE EXCEPTION 'Tabela goals não existe! Execute as migrations iniciais primeiro.';
    END IF;
END $$;

-- Tabela: sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'sales'
    ) THEN
        RAISE EXCEPTION 'Tabela sales não existe! Execute as migrations iniciais primeiro.';
    END IF;
END $$;

-- =============================================================================
-- ETAPA 2: Verificar e criar tabelas de Cashback
-- =============================================================================

-- Tabela: cashback_balance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_balance'
    ) THEN
        CREATE TABLE cashback_balance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
            total_earned DECIMAL(10,2) DEFAULT 0 CHECK (total_earned >= 0),
            total_redeemed DECIMAL(10,2) DEFAULT 0 CHECK (total_redeemed >= 0),
            balance_disponivel DECIMAL(10,2) DEFAULT 0 CHECK (balance_disponivel >= 0),
            balance_pendente DECIMAL(10,2) DEFAULT 0 CHECK (balance_pendente >= 0),
            updated_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(colaboradora_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_cashback_balance_colaboradora ON cashback_balance(colaboradora_id);
    END IF;
END $$;

-- Tabela: cashback_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions'
    ) THEN
        CREATE TABLE cashback_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            colaboradora_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTMENT')),
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            cashback_rule_id UUID,
            renovado BOOLEAN DEFAULT false,
            recuperado BOOLEAN DEFAULT false,
            data_expiracao TIMESTAMP,
            data_liberacao TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_colaboradora ON cashback_transactions(colaboradora_id);
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_sale ON cashback_transactions(sale_id);
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_type ON cashback_transactions(transaction_type);
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_created ON cashback_transactions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_renovado ON cashback_transactions(renovado) WHERE renovado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_recuperado ON cashback_transactions(recuperado) WHERE recuperado = true;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_expiracao ON cashback_transactions(data_expiracao) WHERE data_expiracao IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_cashback_transactions_data_liberacao ON cashback_transactions(data_liberacao) WHERE data_liberacao IS NOT NULL;
    ELSE
        -- Adicionar campos se não existirem
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'renovado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN renovado BOOLEAN DEFAULT false;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'recuperado'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN recuperado BOOLEAN DEFAULT false;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'cashback_transactions' 
            AND column_name = 'data_expiracao'
        ) THEN
            ALTER TABLE cashback_transactions ADD COLUMN data_expiracao TIMESTAMP;
        END IF;
        
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

-- Tabela: cashback_rules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_rules'
    ) THEN
        CREATE TABLE cashback_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
            min_purchase_value DECIMAL(10,2) DEFAULT 0 CHECK (min_purchase_value >= 0),
            max_cashback_per_transaction DECIMAL(10,2),
            valid_from DATE,
            valid_until DATE,
            active BOOLEAN DEFAULT true,
            priority INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_cashback_rules_active ON cashback_rules(active) WHERE active = true;
    END IF;
END $$;

-- Tabela: cashback_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_settings'
    ) THEN
        CREATE TABLE cashback_settings (
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
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(store_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_cashback_settings_store ON cashback_settings(store_id) WHERE store_id IS NOT NULL;
        
        -- Trigger para updated_at
        CREATE OR REPLACE FUNCTION update_cashback_settings_updated_at()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$;
        
        CREATE TRIGGER trigger_update_cashback_settings_updated_at
            BEFORE UPDATE ON cashback_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_cashback_settings_updated_at();
        
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
        
        -- Dados iniciais
        INSERT INTO cashback_settings (
            store_id, prazo_liberacao_dias, prazo_expiracao_dias,
            percentual_cashback, percentual_uso_maximo,
            renovacao_habilitada, renovacao_dias, observacoes
        ) VALUES (
            NULL, 2, 30, 15.00, 30.00, true, 3,
            'Configuração padrão do sistema de cashback'
        )
        ON CONFLICT (store_id) DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- ETAPA 3: Verificar e criar tabelas de ERP/Tiny
-- =============================================================================

-- Tabela: erp_integrations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_integrations'
    ) THEN
        CREATE TABLE erp_integrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            sistema_erp TEXT NOT NULL CHECK (sistema_erp IN ('TINY', 'BLING')),
            client_id TEXT NOT NULL,
            client_secret TEXT NOT NULL,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TIMESTAMP,
            last_sync_at TIMESTAMP,
            sync_status TEXT DEFAULT 'DISCONNECTED' CHECK (sync_status IN ('CONNECTED', 'DISCONNECTED', 'ERROR')),
            error_message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(store_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_erp_integrations_store ON erp_integrations(store_id);
        CREATE INDEX IF NOT EXISTS idx_erp_integrations_sistema ON erp_integrations(sistema_erp);
    END IF;
END $$;

-- Tabela: tiny_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders'
    ) THEN
        CREATE TABLE tiny_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            tiny_id TEXT NOT NULL,
            numero_pedido TEXT,
            numero_ecommerce TEXT,
            situacao TEXT,
            data_pedido TIMESTAMP,
            data_prevista TIMESTAMP,
            cliente_nome TEXT,
            cliente_cpf_cnpj TEXT,
            cliente_email TEXT,
            cliente_telefone TEXT,
            valor_total DECIMAL(10,2),
            valor_desconto DECIMAL(10,2),
            valor_frete DECIMAL(10,2),
            forma_pagamento TEXT,
            forma_envio TEXT,
            endereco_entrega JSONB,
            itens JSONB,
            observacoes TEXT,
            vendedor_nome TEXT,
            vendedor_tiny_id TEXT,
            colaboradora_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
            dados_extras JSONB,
            sync_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(store_id, tiny_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_tiny_orders_store ON tiny_orders(store_id);
        CREATE INDEX IF NOT EXISTS idx_tiny_orders_tiny_id ON tiny_orders(tiny_id);
        CREATE INDEX IF NOT EXISTS idx_tiny_orders_colaboradora ON tiny_orders(colaboradora_id) WHERE colaboradora_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_tiny_orders_data_pedido ON tiny_orders(data_pedido) WHERE data_pedido IS NOT NULL;
    ELSE
        -- Adicionar campos se não existirem
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'tiny_orders' 
            AND column_name = 'vendedor_tiny_id'
        ) THEN
            ALTER TABLE tiny_orders ADD COLUMN vendedor_tiny_id TEXT;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'tiny_orders' 
            AND column_name = 'colaboradora_id'
        ) THEN
            ALTER TABLE tiny_orders ADD COLUMN colaboradora_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_tiny_orders_colaboradora ON tiny_orders(colaboradora_id) WHERE colaboradora_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- Tabela: tiny_contacts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_contacts'
    ) THEN
        CREATE TABLE tiny_contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            tiny_id TEXT NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('F', 'J')),
            cpf_cnpj TEXT,
            email TEXT,
            telefone TEXT,
            celular TEXT,
            endereco JSONB,
            observacoes TEXT,
            dados_extras JSONB,
            sync_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(store_id, tiny_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_tiny_contacts_store ON tiny_contacts(store_id);
        CREATE INDEX IF NOT EXISTS idx_tiny_contacts_tiny_id ON tiny_contacts(tiny_id);
    END IF;
END $$;

-- Tabela: erp_sync_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs'
    ) THEN
        CREATE TABLE erp_sync_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            sistema_erp TEXT NOT NULL CHECK (sistema_erp IN ('TINY', 'BLING')),
            tipo_sync TEXT NOT NULL CHECK (tipo_sync IN ('PEDIDOS', 'CONTATOS', 'PRODUTOS')),
            registros_sincronizados INTEGER DEFAULT 0,
            registros_atualizados INTEGER DEFAULT 0,
            registros_com_erro INTEGER DEFAULT 0,
            status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'ERROR')),
            error_message TEXT,
            data_inicio DATE,
            data_fim DATE,
            tempo_execucao_ms INTEGER,
            total_paginas INTEGER,
            ultimo_tiny_id_sincronizado TEXT,
            sync_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_store ON erp_sync_logs(store_id);
        CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_sistema ON erp_sync_logs(sistema_erp);
        CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_tipo ON erp_sync_logs(tipo_sync);
        CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_status ON erp_sync_logs(status);
        CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_sync_at ON erp_sync_logs(sync_at DESC);
    ELSE
        -- Adicionar campos se não existirem
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'erp_sync_logs' 
            AND column_name = 'ultimo_tiny_id_sincronizado'
        ) THEN
            ALTER TABLE erp_sync_logs ADD COLUMN ultimo_tiny_id_sincronizado TEXT;
            CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_ultimo_id ON erp_sync_logs(ultimo_tiny_id_sincronizado) WHERE ultimo_tiny_id_sincronizado IS NOT NULL;
        END IF;
    END IF;
END $$;

-- =============================================================================
-- ETAPA 4: Verificar campos em stores
-- =============================================================================

DO $$
BEGIN
    -- Adicionar sistema_erp em stores se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'stores' 
        AND column_name = 'sistema_erp'
    ) THEN
        ALTER TABLE stores ADD COLUMN sistema_erp TEXT CHECK (sistema_erp IN ('TINY', 'BLING'));
    END IF;
END $$;

-- =============================================================================
-- ETAPA 5: Verificar RLS Policies
-- =============================================================================

-- Habilitar RLS nas tabelas de cashback
DO $$
BEGIN
    ALTER TABLE cashback_balance ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cashback_rules ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Habilitar RLS nas tabelas de ERP
DO $$
BEGIN
    ALTER TABLE erp_integrations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tiny_orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tiny_contacts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- ETAPA 6: Verificar funções necessárias
-- =============================================================================

-- Função get_user_role (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'sistemaretiradas'
        AND p.proname = 'get_user_role'
    ) THEN
        CREATE OR REPLACE FUNCTION get_user_role() 
        RETURNS TEXT 
        LANGUAGE plpgsql 
        SECURITY DEFINER 
        SET search_path = sistemaretiradas, public 
        STABLE 
        AS $func$
        DECLARE
            v_role TEXT;
        BEGIN
            SELECT role::text INTO v_role 
            FROM profiles 
            WHERE id = auth.uid();
            RETURN v_role;
        END;
        $func$;
    END IF;
END $$;

-- =============================================================================
-- ETAPA 7: Verificar índices importantes
-- =============================================================================

-- Índices em cashback_balance
CREATE INDEX IF NOT EXISTS idx_cashback_balance_updated ON cashback_balance(updated_at);

-- Índices em erp_sync_logs
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_ultimo_id ON erp_sync_logs(ultimo_tiny_id_sincronizado) WHERE ultimo_tiny_id_sincronizado IS NOT NULL;

-- =============================================================================
-- ETAPA 8: Verificar dados iniciais
-- =============================================================================

-- Garantir que existe configuração global de cashback
INSERT INTO cashback_settings (
    store_id, prazo_liberacao_dias, prazo_expiracao_dias,
    percentual_cashback, percentual_uso_maximo,
    renovacao_habilitada, renovacao_dias, observacoes
)
SELECT 
    NULL, 2, 30, 15.00, 30.00, true, 3,
    'Configuração padrão do sistema de cashback'
WHERE NOT EXISTS (
    SELECT 1 FROM cashback_settings WHERE store_id IS NULL
);

-- =============================================================================
-- FIM DA VERIFICAÇÃO
-- =============================================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Verificação completa executada com sucesso!';
    RAISE NOTICE 'Todas as estruturas necessárias foram verificadas/criadas.';
END $$;

