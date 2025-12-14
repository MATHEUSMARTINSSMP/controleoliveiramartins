-- =============================================================================
-- INTEGRAÇÃO LINX MICROVIX - Hub de Fidelidade
-- Sistema de Retiradas - Multi-tenant ERP Integration
-- =============================================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: sistemaretiradas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: linx_microvix_config
-- Configurações de integração Linx Microvix por loja (multi-tenant)
-- Similar à erp_integrations mas específica para Linx Hub Fidelidade
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Credenciais de autenticação
    cnpj VARCHAR(18) NOT NULL,
    token_produto VARCHAR(600), -- Token do produto (Microvix/Seta)
    token_parceiro VARCHAR(600), -- Token do parceiro fidelidade
    id_parceiro INTEGER, -- ID do parceiro obtido via BuscarParceiros
    nome_loja VARCHAR(255) NOT NULL,
    
    -- Ambiente
    ambiente VARCHAR(20) DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
    url_producao VARCHAR(500), -- URL específica de produção (fornecida pela Linx)
    
    -- Status
    active BOOLEAN DEFAULT true,
    sync_status VARCHAR(50) DEFAULT 'DISCONNECTED' CHECK (sync_status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING')),
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Configurações adicionais
    config_adicional JSONB DEFAULT '{}'::jsonb,
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    -- Constraint: apenas uma config ativa por loja
    CONSTRAINT linx_microvix_config_unique_store UNIQUE (store_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_linx_microvix_config_store ON sistemaretiradas.linx_microvix_config(store_id);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_config_cnpj ON sistemaretiradas.linx_microvix_config(cnpj);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_config_active ON sistemaretiradas.linx_microvix_config(active);

-- RLS
ALTER TABLE sistemaretiradas.linx_microvix_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_config_tenant_isolation" ON sistemaretiradas.linx_microvix_config
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE tenant_id = (
                SELECT tenant_id FROM sistemaretiradas.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "linx_microvix_config_service_role" ON sistemaretiradas.linx_microvix_config
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_linx_microvix_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_linx_microvix_config_updated_at ON sistemaretiradas.linx_microvix_config;
CREATE TRIGGER trigger_linx_microvix_config_updated_at
    BEFORE UPDATE ON sistemaretiradas.linx_microvix_config
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_linx_microvix_config_updated_at();

-- -----------------------------------------------------------------------------
-- 2. TABELA: linx_microvix_parceiros
-- Cache de parceiros disponíveis (obtidos via BuscarParceiros)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_parceiros (
    id SERIAL PRIMARY KEY,
    id_parceiro INTEGER NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (parceiros são globais, visíveis para todos)
ALTER TABLE sistemaretiradas.linx_microvix_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_parceiros_read_all" ON sistemaretiradas.linx_microvix_parceiros
    FOR SELECT USING (true);

CREATE POLICY "linx_microvix_parceiros_service_role" ON sistemaretiradas.linx_microvix_parceiros
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 3. TABELA: linx_microvix_clientes
-- Cache de clientes sincronizados do Hub Fidelidade
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Identificação
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255),
    celular VARCHAR(20),
    email VARCHAR(255),
    
    -- Saldo de fidelidade
    saldo_atual DECIMAL(15,2) DEFAULT 0,
    saldo_disponivel DECIMAL(15,2) DEFAULT 0,
    
    -- Controle de PIN
    utiliza_pin BOOLEAN DEFAULT false,
    tipo_pin INTEGER, -- 1 = Celular, 2 = Email
    cliente_cadastrado BOOLEAN DEFAULT false,
    
    -- Dados extras do cadastro
    data_nascimento DATE,
    sexo INTEGER, -- 0 = NaoInformado, 1 = Masculino, 2 = Feminino
    endereco JSONB,
    
    -- Auditoria
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: CPF único por loja
    CONSTRAINT linx_microvix_clientes_unique_cpf_store UNIQUE (store_id, cpf)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_linx_microvix_clientes_store ON sistemaretiradas.linx_microvix_clientes(store_id);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_clientes_cpf ON sistemaretiradas.linx_microvix_clientes(cpf);

-- RLS
ALTER TABLE sistemaretiradas.linx_microvix_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_clientes_tenant_isolation" ON sistemaretiradas.linx_microvix_clientes
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE tenant_id = (
                SELECT tenant_id FROM sistemaretiradas.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "linx_microvix_clientes_service_role" ON sistemaretiradas.linx_microvix_clientes
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_linx_microvix_clientes_updated_at ON sistemaretiradas.linx_microvix_clientes;
CREATE TRIGGER trigger_linx_microvix_clientes_updated_at
    BEFORE UPDATE ON sistemaretiradas.linx_microvix_clientes
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_linx_microvix_config_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TABELA: linx_microvix_transacoes
-- Log de todas as transações com o Hub Fidelidade
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Identificação da transação
    identificador_transacao VARCHAR(100) NOT NULL, -- GUID da Linx
    tipo_operacao VARCHAR(50) NOT NULL, -- AtualizarCliente, ConsultarSaldo, GerarBonus, etc.
    
    -- Referências
    cpf_cliente VARCHAR(14),
    venda_id UUID, -- Referência opcional à venda no sistema
    
    -- Request/Response
    request_payload JSONB,
    response_payload JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'ERROR')),
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Valores
    valor_bruto DECIMAL(15,2),
    valor_liquido DECIMAL(15,2),
    valor_resgate DECIMAL(15,2),
    saldo_gerado DECIMAL(15,2),
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_store ON sistemaretiradas.linx_microvix_transacoes(store_id);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_cpf ON sistemaretiradas.linx_microvix_transacoes(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_tipo ON sistemaretiradas.linx_microvix_transacoes(tipo_operacao);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_status ON sistemaretiradas.linx_microvix_transacoes(status);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_created ON sistemaretiradas.linx_microvix_transacoes(created_at);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_transacoes_identificador ON sistemaretiradas.linx_microvix_transacoes(identificador_transacao);

-- RLS
ALTER TABLE sistemaretiradas.linx_microvix_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_transacoes_tenant_isolation" ON sistemaretiradas.linx_microvix_transacoes
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE tenant_id = (
                SELECT tenant_id FROM sistemaretiradas.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "linx_microvix_transacoes_service_role" ON sistemaretiradas.linx_microvix_transacoes
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 5. TABELA: linx_microvix_campanhas
-- Campanhas de fidelidade disponíveis
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- Dados da campanha (vindos da API)
    id_campanha INTEGER NOT NULL,
    descricao VARCHAR(500),
    texto_complementar TEXT,
    valor_desconto DECIMAL(15,2),
    data_inicio TIMESTAMPTZ,
    data_final TIMESTAMPTZ,
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Auditoria
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: campanha única por loja
    CONSTRAINT linx_microvix_campanhas_unique UNIQUE (store_id, id_campanha)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_linx_microvix_campanhas_store ON sistemaretiradas.linx_microvix_campanhas(store_id);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_campanhas_active ON sistemaretiradas.linx_microvix_campanhas(active);

-- RLS
ALTER TABLE sistemaretiradas.linx_microvix_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_campanhas_tenant_isolation" ON sistemaretiradas.linx_microvix_campanhas
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE tenant_id = (
                SELECT tenant_id FROM sistemaretiradas.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "linx_microvix_campanhas_service_role" ON sistemaretiradas.linx_microvix_campanhas
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 6. TABELA: linx_microvix_bonus
-- Histórico de bônus gerados/resgatados/estornados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistemaretiradas.linx_microvix_bonus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    transacao_id UUID REFERENCES sistemaretiradas.linx_microvix_transacoes(id),
    
    -- Identificação
    cpf_cliente VARCHAR(14) NOT NULL,
    identificador_transacao VARCHAR(100),
    
    -- Tipo de operação
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('GERACAO', 'RESGATE', 'ESTORNO')),
    
    -- Valores
    valor DECIMAL(15,2) NOT NULL,
    saldo_anterior DECIMAL(15,2),
    saldo_posterior DECIMAL(15,2),
    
    -- Campanha (se aplicável)
    campanha_id INTEGER,
    campanha_descricao VARCHAR(500),
    
    -- Venda relacionada
    venda_id UUID,
    valor_venda DECIMAL(15,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'ERROR', 'ESTORNADO')),
    
    -- Auditoria
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_linx_microvix_bonus_store ON sistemaretiradas.linx_microvix_bonus(store_id);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_bonus_cpf ON sistemaretiradas.linx_microvix_bonus(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_bonus_tipo ON sistemaretiradas.linx_microvix_bonus(tipo);
CREATE INDEX IF NOT EXISTS idx_linx_microvix_bonus_created ON sistemaretiradas.linx_microvix_bonus(created_at);

-- RLS
ALTER TABLE sistemaretiradas.linx_microvix_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_microvix_bonus_tenant_isolation" ON sistemaretiradas.linx_microvix_bonus
    FOR ALL USING (
        store_id IN (
            SELECT id FROM sistemaretiradas.stores 
            WHERE tenant_id = (
                SELECT tenant_id FROM sistemaretiradas.profiles 
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "linx_microvix_bonus_service_role" ON sistemaretiradas.linx_microvix_bonus
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 7. ATUALIZAR TABELA erp_integrations (se existir)
-- Adicionar suporte ao MICROVIX no enum/check
-- -----------------------------------------------------------------------------
-- Verificar se existe e atualizar constraint
DO $$
BEGIN
    -- Tentar dropar constraint existente e recriar com MICROVIX
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_integrations'
        AND constraint_name = 'erp_integrations_sistema_erp_check'
    ) THEN
        ALTER TABLE sistemaretiradas.erp_integrations 
        DROP CONSTRAINT erp_integrations_sistema_erp_check;
        
        ALTER TABLE sistemaretiradas.erp_integrations 
        ADD CONSTRAINT erp_integrations_sistema_erp_check 
        CHECK (sistema_erp IN ('TINY', 'BLING', 'MICROVIX', 'CONTA_AZUL', 'LINX'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignorar se não existir
END $$;

-- -----------------------------------------------------------------------------
-- 8. VIEWS ÚTEIS
-- -----------------------------------------------------------------------------

-- View: Resumo de clientes por loja
CREATE OR REPLACE VIEW sistemaretiradas.vw_linx_microvix_clientes_resumo AS
SELECT 
    c.store_id,
    s.name as store_name,
    COUNT(*) as total_clientes,
    COUNT(*) FILTER (WHERE c.cliente_cadastrado = true) as clientes_cadastrados,
    SUM(c.saldo_disponivel) as saldo_total_disponivel,
    MAX(c.last_sync_at) as ultima_sincronizacao
FROM sistemaretiradas.linx_microvix_clientes c
JOIN sistemaretiradas.stores s ON s.id = c.store_id
GROUP BY c.store_id, s.name;

-- View: Resumo de bônus por loja
CREATE OR REPLACE VIEW sistemaretiradas.vw_linx_microvix_bonus_resumo AS
SELECT 
    b.store_id,
    s.name as store_name,
    DATE_TRUNC('month', b.created_at) as mes,
    b.tipo,
    COUNT(*) as quantidade,
    SUM(b.valor) as valor_total
FROM sistemaretiradas.linx_microvix_bonus b
JOIN sistemaretiradas.stores s ON s.id = b.store_id
WHERE b.status = 'SUCCESS'
GROUP BY b.store_id, s.name, DATE_TRUNC('month', b.created_at), b.tipo;

-- -----------------------------------------------------------------------------
-- 9. FUNÇÕES ÚTEIS
-- -----------------------------------------------------------------------------

-- Função: Buscar configuração Linx por store_id
CREATE OR REPLACE FUNCTION sistemaretiradas.get_linx_microvix_config(p_store_id UUID)
RETURNS sistemaretiradas.linx_microvix_config AS $$
DECLARE
    v_config sistemaretiradas.linx_microvix_config;
BEGIN
    SELECT * INTO v_config
    FROM sistemaretiradas.linx_microvix_config
    WHERE store_id = p_store_id AND active = true
    LIMIT 1;
    
    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Atualizar saldo do cliente após transação
CREATE OR REPLACE FUNCTION sistemaretiradas.update_linx_cliente_saldo(
    p_store_id UUID,
    p_cpf VARCHAR(14),
    p_saldo_atual DECIMAL(15,2),
    p_saldo_disponivel DECIMAL(15,2)
)
RETURNS VOID AS $$
BEGIN
    UPDATE sistemaretiradas.linx_microvix_clientes
    SET 
        saldo_atual = p_saldo_atual,
        saldo_disponivel = p_saldo_disponivel,
        last_sync_at = NOW(),
        updated_at = NOW()
    WHERE store_id = p_store_id AND cpf = p_cpf;
    
    -- Se não existe, inserir
    IF NOT FOUND THEN
        INSERT INTO sistemaretiradas.linx_microvix_clientes (store_id, cpf, saldo_atual, saldo_disponivel, cliente_cadastrado)
        VALUES (p_store_id, p_cpf, p_saldo_atual, p_saldo_disponivel, true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar transação
CREATE OR REPLACE FUNCTION sistemaretiradas.log_linx_transacao(
    p_store_id UUID,
    p_identificador_transacao VARCHAR(100),
    p_tipo_operacao VARCHAR(50),
    p_cpf_cliente VARCHAR(14),
    p_request_payload JSONB,
    p_response_payload JSONB,
    p_status VARCHAR(20),
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO sistemaretiradas.linx_microvix_transacoes (
        store_id,
        identificador_transacao,
        tipo_operacao,
        cpf_cliente,
        request_payload,
        response_payload,
        status,
        error_message,
        processed_at
    ) VALUES (
        p_store_id,
        p_identificador_transacao,
        p_tipo_operacao,
        p_cpf_cliente,
        p_request_payload,
        p_response_payload,
        p_status,
        p_error_message,
        NOW()
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- COMENTÁRIOS DAS TABELAS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE sistemaretiradas.linx_microvix_config IS 'Configurações de integração Linx Microvix Hub Fidelidade por loja';
COMMENT ON TABLE sistemaretiradas.linx_microvix_parceiros IS 'Cache de parceiros de fidelidade disponíveis na Linx';
COMMENT ON TABLE sistemaretiradas.linx_microvix_clientes IS 'Clientes sincronizados com o Hub Fidelidade Linx';
COMMENT ON TABLE sistemaretiradas.linx_microvix_transacoes IS 'Log de transações com o Hub Fidelidade Linx';
COMMENT ON TABLE sistemaretiradas.linx_microvix_campanhas IS 'Campanhas de fidelidade ativas por loja';
COMMENT ON TABLE sistemaretiradas.linx_microvix_bonus IS 'Histórico de bônus (geração, resgate, estorno)';

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
