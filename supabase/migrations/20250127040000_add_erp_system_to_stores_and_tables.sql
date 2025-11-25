-- =============================================================================
-- ESTRUTURA COMPLETA: Sistema ERP por Loja + Tabelas de Dados
-- =============================================================================
-- Cada loja seleciona seu sistema ERP no cadastro
-- Cada sistema tem suas próprias tabelas de dados sincronizados
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- =============================================================================
-- 1. ADICIONAR CAMPO sistema_erp NA TABELA stores
-- =============================================================================
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS sistema_erp TEXT DEFAULT NULL;

-- Constraint para valores válidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_sistema_erp'
    ) THEN
        ALTER TABLE stores
        ADD CONSTRAINT check_sistema_erp 
        CHECK (sistema_erp IN ('TINY', 'BLING', 'MICROVIX', 'CONTA_AZUL') OR sistema_erp IS NULL);
    END IF;
END $$;

-- Comentário
COMMENT ON COLUMN stores.sistema_erp IS 'Sistema ERP utilizado pela loja: TINY, BLING, MICROVIX, CONTA_AZUL';

-- =============================================================================
-- 2. ATUALIZAR TRIGGER DE VALIDAÇÃO (se erp_integrations existir)
-- =============================================================================
-- O trigger já foi criado na migration anterior
-- Aqui apenas garantimos que está ativo

-- Criar função (se não existir)
CREATE OR REPLACE FUNCTION validate_erp_integration_sistema()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_store_sistema TEXT;
BEGIN
    -- Buscar sistema_erp da loja
    SELECT sistema_erp INTO v_store_sistema
    FROM stores
    WHERE id = NEW.store_id;
    
    -- Se a loja tem sistema_erp definido, deve bater com a integração
    IF v_store_sistema IS NOT NULL AND v_store_sistema != NEW.sistema_erp THEN
        RAISE EXCEPTION 'sistema_erp da integração (%) não corresponde ao sistema_erp da loja (%)', 
            NEW.sistema_erp, v_store_sistema;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger (se a tabela existir)
DO $$
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_integrations'
    ) THEN
        -- Criar trigger se não existir
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'trigger_validate_erp_integration_sistema'
        ) THEN
            CREATE TRIGGER trigger_validate_erp_integration_sistema
                BEFORE INSERT OR UPDATE ON erp_integrations
                FOR EACH ROW
                EXECUTE FUNCTION validate_erp_integration_sistema();
        END IF;
    END IF;
END $$;

-- =============================================================================
-- 3. TABELAS DE DADOS TINY ERP
-- =============================================================================

-- Produtos do Tiny
CREATE TABLE IF NOT EXISTS tiny_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tiny_id TEXT NOT NULL, -- ID do produto no Tiny
    nome TEXT NOT NULL,
    preco DECIMAL(10,2),
    preco_custo DECIMAL(10,2),
    estoque INTEGER DEFAULT 0,
    estoque_minimo INTEGER,
    categoria TEXT,
    sku TEXT,
    codigo_barras TEXT,
    ncm TEXT,
    cest TEXT,
    unidade TEXT DEFAULT 'UN',
    peso DECIMAL(10,3),
    largura DECIMAL(10,2),
    altura DECIMAL(10,2),
    profundidade DECIMAL(10,2),
    ativo BOOLEAN DEFAULT true,
    tipo TEXT, -- 'P' (Produto), 'S' (Serviço), 'E' (Embalagem)
    dados_extras JSONB, -- Campos adicionais do Tiny
    sync_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, tiny_id)
);

-- Índices para tiny_products
CREATE INDEX IF NOT EXISTS idx_tiny_products_store ON tiny_products(store_id);
CREATE INDEX IF NOT EXISTS idx_tiny_products_tiny_id ON tiny_products(tiny_id);
CREATE INDEX IF NOT EXISTS idx_tiny_products_sku ON tiny_products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_products_ativo ON tiny_products(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_tiny_products_sync_at ON tiny_products(sync_at);

-- Pedidos/Vendas do Tiny
CREATE TABLE IF NOT EXISTS tiny_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tiny_id TEXT NOT NULL, -- ID do pedido no Tiny
    numero_pedido TEXT,
    numero_ecommerce TEXT,
    situacao TEXT, -- 'aberto', 'atendido', 'cancelado', etc
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
    endereco_entrega JSONB, -- Endereço completo em JSON
    itens JSONB, -- Array de itens do pedido
    observacoes TEXT,
    vendedor_nome TEXT,
    dados_extras JSONB, -- Campos adicionais do Tiny
    sync_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, tiny_id)
);

-- Índices para tiny_orders
CREATE INDEX IF NOT EXISTS idx_tiny_orders_store ON tiny_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_tiny_orders_tiny_id ON tiny_orders(tiny_id);
CREATE INDEX IF NOT EXISTS idx_tiny_orders_numero ON tiny_orders(numero_pedido) WHERE numero_pedido IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_orders_data ON tiny_orders(data_pedido);
CREATE INDEX IF NOT EXISTS idx_tiny_orders_situacao ON tiny_orders(situacao);
CREATE INDEX IF NOT EXISTS idx_tiny_orders_sync_at ON tiny_orders(sync_at);

-- Contatos/Clientes do Tiny
CREATE TABLE IF NOT EXISTS tiny_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tiny_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT, -- 'F' (Física), 'J' (Jurídica)
    cpf_cnpj TEXT,
    email TEXT,
    telefone TEXT,
    celular TEXT,
    endereco JSONB,
    observacoes TEXT,
    dados_extras JSONB,
    sync_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(store_id, tiny_id)
);

-- Índices para tiny_contacts
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_store ON tiny_contacts(store_id);
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_tiny_id ON tiny_contacts(tiny_id);
CREATE INDEX IF NOT EXISTS idx_tiny_contacts_cpf_cnpj ON tiny_contacts(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL;

-- =============================================================================
-- 4. RLS (Row Level Security) - Frontend pode ler, backend escreve
-- =============================================================================

-- tiny_products
ALTER TABLE tiny_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_tiny_products_all" ON tiny_products;
CREATE POLICY "admin_tiny_products_all" ON tiny_products
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "loja_tiny_products_read" ON tiny_products;
CREATE POLICY "loja_tiny_products_read" ON tiny_products
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.store_default = tiny_products.store_id::text
        )
    );

-- tiny_orders
ALTER TABLE tiny_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_tiny_orders_all" ON tiny_orders;
CREATE POLICY "admin_tiny_orders_all" ON tiny_orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "loja_tiny_orders_read" ON tiny_orders;
CREATE POLICY "loja_tiny_orders_read" ON tiny_orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.store_default = tiny_orders.store_id::text
        )
    );

-- tiny_contacts
ALTER TABLE tiny_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_tiny_contacts_all" ON tiny_contacts;
CREATE POLICY "admin_tiny_contacts_all" ON tiny_contacts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "loja_tiny_contacts_read" ON tiny_contacts;
CREATE POLICY "loja_tiny_contacts_read" ON tiny_contacts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.store_default = tiny_contacts.store_id::text
        )
    );

-- =============================================================================
-- 5. TRIGGERS para updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_tiny_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_tiny_products_updated_at
    BEFORE UPDATE ON tiny_products
    FOR EACH ROW
    EXECUTE FUNCTION update_tiny_products_updated_at();

CREATE OR REPLACE FUNCTION update_tiny_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_tiny_orders_updated_at
    BEFORE UPDATE ON tiny_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_tiny_orders_updated_at();

CREATE OR REPLACE FUNCTION update_tiny_contacts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_tiny_contacts_updated_at
    BEFORE UPDATE ON tiny_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_tiny_contacts_updated_at();

-- =============================================================================
-- 6. LOGS DE SINCRONIZAÇÃO
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sistema_erp TEXT NOT NULL,
    tipo_sync TEXT NOT NULL, -- 'PRODUTOS', 'PEDIDOS', 'CONTATOS', 'ESTOQUE'
    status TEXT NOT NULL, -- 'SUCCESS', 'ERROR', 'PARTIAL'
    registros_sincronizados INTEGER DEFAULT 0,
    registros_erro INTEGER DEFAULT 0,
    error_message TEXT,
    tempo_execucao_ms INTEGER,
    sync_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_store ON erp_sync_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_sistema ON erp_sync_logs(sistema_erp);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_tipo ON erp_sync_logs(tipo_sync);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_status ON erp_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_sync_at ON erp_sync_logs(sync_at);

-- RLS para logs
ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_erp_sync_logs_all" ON erp_sync_logs;
CREATE POLICY "admin_erp_sync_logs_all" ON erp_sync_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "loja_erp_sync_logs_read" ON erp_sync_logs;
CREATE POLICY "loja_erp_sync_logs_read" ON erp_sync_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'LOJA'
            AND profiles.store_default = erp_sync_logs.store_id::text
        )
    );

-- =============================================================================
-- 7. COMENTÁRIOS
-- =============================================================================

COMMENT ON TABLE tiny_products IS 'Produtos sincronizados do Tiny ERP - Estrutura específica para dados do Tiny';
COMMENT ON TABLE tiny_orders IS 'Pedidos/Vendas sincronizados do Tiny ERP';
COMMENT ON TABLE tiny_contacts IS 'Contatos/Clientes sincronizados do Tiny ERP';
COMMENT ON TABLE erp_sync_logs IS 'Logs de sincronização de dados ERP por loja';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

