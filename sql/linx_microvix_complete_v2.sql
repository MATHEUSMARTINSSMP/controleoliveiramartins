-- =============================================================================
-- INTEGRAÇÃO COMPLETA LINX MICROVIX - VERSÃO 2 (RLS SIMPLIFICADO)
-- Sistema de Retiradas - Multi-tenant ERP Integration
-- =============================================================================
-- Execute este SQL no Supabase SQL Editor
-- Schema: sistemaretiradas
-- =============================================================================

-- #############################################################################
-- PARTE 1: LIMPEZA E CRIAÇÃO DAS TABELAS
-- #############################################################################

DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_bonus CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_campanhas CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_transacoes CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_clientes CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_parceiros CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_vendas_itens CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_vendas CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_sync_log CASCADE;
DROP TABLE IF EXISTS sistemaretiradas.linx_microvix_config CASCADE;

-- -----------------------------------------------------------------------------
-- 1.1 TABELA: linx_microvix_config
-- Configurações de integração Linx Microvix por loja
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    
    -- CREDENCIAIS HUB FIDELIDADE
    cnpj VARCHAR(18) NOT NULL,
    nome_loja VARCHAR(255) NOT NULL,
    hub_token_produto VARCHAR(600),
    hub_token_parceiro VARCHAR(600),
    hub_id_parceiro INTEGER,
    hub_ambiente VARCHAR(20) DEFAULT 'homologacao' CHECK (hub_ambiente IN ('homologacao', 'producao')),
    hub_url_producao VARCHAR(500),
    hub_active BOOLEAN DEFAULT false,
    hub_sync_status VARCHAR(50) DEFAULT 'DISCONNECTED' CHECK (hub_sync_status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING')),
    hub_last_sync_at TIMESTAMPTZ,
    hub_error_message TEXT,
    
    -- CREDENCIAIS WEBSERVICE DE SAÍDA (VENDAS)
    ws_portal VARCHAR(50),
    ws_chave VARCHAR(600),
    ws_usuario VARCHAR(100) DEFAULT 'linx_b2c',
    ws_senha VARCHAR(255) DEFAULT 'linx_b2c',
    ws_grupo VARCHAR(100),
    ws_ambiente VARCHAR(20) DEFAULT 'homologacao' CHECK (ws_ambiente IN ('homologacao', 'producao')),
    ws_url_homologacao VARCHAR(500) DEFAULT 'http://webapi.microvix.com.br/1.0/api/integracao',
    ws_url_producao VARCHAR(500),
    ws_active BOOLEAN DEFAULT false,
    ws_sync_status VARCHAR(50) DEFAULT 'DISCONNECTED' CHECK (ws_sync_status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING')),
    ws_last_sync_at TIMESTAMPTZ,
    ws_error_message TEXT,
    ws_last_timestamp BIGINT DEFAULT 0,
    
    -- CONFIGURAÇÕES GERAIS
    active BOOLEAN DEFAULT true,
    config_adicional JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT linx_microvix_config_unique_store UNIQUE (store_id)
);

CREATE INDEX idx_linx_config_store ON sistemaretiradas.linx_microvix_config(store_id);
CREATE INDEX idx_linx_config_cnpj ON sistemaretiradas.linx_microvix_config(cnpj);

ALTER TABLE sistemaretiradas.linx_microvix_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_config_select_authenticated" ON sistemaretiradas.linx_microvix_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_config_all_service_role" ON sistemaretiradas.linx_microvix_config
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION sistemaretiradas.update_linx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_linx_config_updated_at
    BEFORE UPDATE ON sistemaretiradas.linx_microvix_config
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_linx_updated_at();

-- -----------------------------------------------------------------------------
-- 1.2 TABELA: linx_microvix_parceiros
-- Cache de parceiros de fidelidade
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_parceiros (
    id SERIAL PRIMARY KEY,
    id_parceiro INTEGER NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sistemaretiradas.linx_microvix_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_parceiros_select_all" ON sistemaretiradas.linx_microvix_parceiros
    FOR SELECT USING (true);

CREATE POLICY "linx_parceiros_all_service_role" ON sistemaretiradas.linx_microvix_parceiros
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 1.3 TABELA: linx_microvix_clientes
-- Clientes do Hub Fidelidade com saldo de pontos
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255),
    celular VARCHAR(20),
    email VARCHAR(255),
    saldo_atual DECIMAL(15,2) DEFAULT 0,
    saldo_disponivel DECIMAL(15,2) DEFAULT 0,
    utiliza_pin BOOLEAN DEFAULT false,
    tipo_pin INTEGER,
    cliente_cadastrado BOOLEAN DEFAULT false,
    data_nascimento DATE,
    sexo INTEGER,
    endereco JSONB,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT linx_clientes_unique_cpf_store UNIQUE (store_id, cpf)
);

CREATE INDEX idx_linx_clientes_store ON sistemaretiradas.linx_microvix_clientes(store_id);
CREATE INDEX idx_linx_clientes_cpf ON sistemaretiradas.linx_microvix_clientes(cpf);

ALTER TABLE sistemaretiradas.linx_microvix_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_clientes_select_authenticated" ON sistemaretiradas.linx_microvix_clientes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_clientes_all_service_role" ON sistemaretiradas.linx_microvix_clientes
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 1.4 TABELA: linx_microvix_transacoes
-- Log de transações com o Hub Fidelidade
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    identificador_transacao VARCHAR(100) NOT NULL,
    tipo_operacao VARCHAR(50) NOT NULL,
    cpf_cliente VARCHAR(14),
    venda_id UUID,
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'ERROR')),
    error_code VARCHAR(50),
    error_message TEXT,
    valor_bruto DECIMAL(15,2),
    valor_liquido DECIMAL(15,2),
    valor_resgate DECIMAL(15,2),
    saldo_gerado DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_linx_transacoes_store ON sistemaretiradas.linx_microvix_transacoes(store_id);
CREATE INDEX idx_linx_transacoes_cpf ON sistemaretiradas.linx_microvix_transacoes(cpf_cliente);
CREATE INDEX idx_linx_transacoes_status ON sistemaretiradas.linx_microvix_transacoes(status);

ALTER TABLE sistemaretiradas.linx_microvix_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_transacoes_select_authenticated" ON sistemaretiradas.linx_microvix_transacoes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_transacoes_all_service_role" ON sistemaretiradas.linx_microvix_transacoes
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 1.5 TABELA: linx_microvix_campanhas
-- Campanhas de fidelidade ativas
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    id_campanha INTEGER NOT NULL,
    descricao VARCHAR(500),
    texto_complementar TEXT,
    valor_desconto DECIMAL(15,2),
    data_inicio TIMESTAMPTZ,
    data_final TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT linx_campanhas_unique UNIQUE (store_id, id_campanha)
);

CREATE INDEX idx_linx_campanhas_store ON sistemaretiradas.linx_microvix_campanhas(store_id);

ALTER TABLE sistemaretiradas.linx_microvix_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_campanhas_select_authenticated" ON sistemaretiradas.linx_microvix_campanhas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_campanhas_all_service_role" ON sistemaretiradas.linx_microvix_campanhas
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 1.6 TABELA: linx_microvix_bonus
-- Histórico de bônus gerados/resgatados/estornados
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_bonus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    transacao_id UUID REFERENCES sistemaretiradas.linx_microvix_transacoes(id),
    cpf_cliente VARCHAR(14) NOT NULL,
    identificador_transacao VARCHAR(100),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('GERACAO', 'RESGATE', 'ESTORNO')),
    valor DECIMAL(15,2) NOT NULL,
    saldo_anterior DECIMAL(15,2),
    saldo_posterior DECIMAL(15,2),
    campanha_id INTEGER,
    campanha_descricao VARCHAR(500),
    venda_id UUID,
    valor_venda DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'ERROR', 'ESTORNADO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX idx_linx_bonus_store ON sistemaretiradas.linx_microvix_bonus(store_id);
CREATE INDEX idx_linx_bonus_cpf ON sistemaretiradas.linx_microvix_bonus(cpf_cliente);
CREATE INDEX idx_linx_bonus_tipo ON sistemaretiradas.linx_microvix_bonus(tipo);

ALTER TABLE sistemaretiradas.linx_microvix_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_bonus_select_authenticated" ON sistemaretiradas.linx_microvix_bonus
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_bonus_all_service_role" ON sistemaretiradas.linx_microvix_bonus
    FOR ALL USING (auth.role() = 'service_role');

-- #############################################################################
-- PARTE 2: WEBSERVICE DE SAÍDA (VENDAS)
-- #############################################################################

-- -----------------------------------------------------------------------------
-- 2.1 TABELA: linx_microvix_vendas
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    id_transacao VARCHAR(100) NOT NULL,
    numero_documento VARCHAR(50),
    serie_documento VARCHAR(10),
    tipo_movimento VARCHAR(50),
    cod_cliente VARCHAR(50),
    doc_cliente VARCHAR(20),
    nome_cliente VARCHAR(255),
    cod_vendedor VARCHAR(50),
    nome_vendedor VARCHAR(255),
    valor_bruto DECIMAL(15,2) DEFAULT 0,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    valor_liquido DECIMAL(15,2) DEFAULT 0,
    valor_frete DECIMAL(15,2) DEFAULT 0,
    data_venda TIMESTAMPTZ NOT NULL,
    data_emissao TIMESTAMPTZ,
    data_faturamento TIMESTAMPTZ,
    situacao VARCHAR(50),
    cancelado BOOLEAN DEFAULT false,
    forma_pagamento VARCHAR(100),
    condicao_pagamento VARCHAR(100),
    observacao TEXT,
    dados_originais JSONB,
    timestamp_linx BIGINT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT linx_vendas_unique UNIQUE (store_id, id_transacao)
);

CREATE INDEX idx_linx_vendas_store ON sistemaretiradas.linx_microvix_vendas(store_id);
CREATE INDEX idx_linx_vendas_data ON sistemaretiradas.linx_microvix_vendas(data_venda);
CREATE INDEX idx_linx_vendas_cliente ON sistemaretiradas.linx_microvix_vendas(doc_cliente);
CREATE INDEX idx_linx_vendas_vendedor ON sistemaretiradas.linx_microvix_vendas(cod_vendedor);

ALTER TABLE sistemaretiradas.linx_microvix_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_vendas_select_authenticated" ON sistemaretiradas.linx_microvix_vendas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_vendas_all_service_role" ON sistemaretiradas.linx_microvix_vendas
    FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER trigger_linx_vendas_updated_at
    BEFORE UPDATE ON sistemaretiradas.linx_microvix_vendas
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_linx_updated_at();

-- -----------------------------------------------------------------------------
-- 2.2 TABELA: linx_microvix_vendas_itens
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_vendas_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID NOT NULL REFERENCES sistemaretiradas.linx_microvix_vendas(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    cod_produto VARCHAR(50),
    descricao_produto VARCHAR(500),
    codigo_barras VARCHAR(50),
    referencia VARCHAR(100),
    quantidade DECIMAL(15,4) DEFAULT 1,
    valor_unitario DECIMAL(15,4) DEFAULT 0,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    valor_total DECIMAL(15,2) DEFAULT 0,
    unidade VARCHAR(20),
    ncm VARCHAR(20),
    dados_originais JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linx_vendas_itens_venda ON sistemaretiradas.linx_microvix_vendas_itens(venda_id);
CREATE INDEX idx_linx_vendas_itens_store ON sistemaretiradas.linx_microvix_vendas_itens(store_id);

ALTER TABLE sistemaretiradas.linx_microvix_vendas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_vendas_itens_select_authenticated" ON sistemaretiradas.linx_microvix_vendas_itens
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_vendas_itens_all_service_role" ON sistemaretiradas.linx_microvix_vendas_itens
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 2.3 TABELA: linx_microvix_sync_log
-- -----------------------------------------------------------------------------
CREATE TABLE sistemaretiradas.linx_microvix_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    tipo_sync VARCHAR(50) NOT NULL,
    metodo VARCHAR(100) NOT NULL,
    timestamp_inicio BIGINT,
    timestamp_fim BIGINT,
    registros_processados INTEGER DEFAULT 0,
    registros_inseridos INTEGER DEFAULT 0,
    registros_atualizados INTEGER DEFAULT 0,
    registros_erro INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR')),
    error_message TEXT,
    duracao_ms INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_linx_sync_log_store ON sistemaretiradas.linx_microvix_sync_log(store_id);
CREATE INDEX idx_linx_sync_log_status ON sistemaretiradas.linx_microvix_sync_log(status);

ALTER TABLE sistemaretiradas.linx_microvix_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linx_sync_log_select_authenticated" ON sistemaretiradas.linx_microvix_sync_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "linx_sync_log_all_service_role" ON sistemaretiradas.linx_microvix_sync_log
    FOR ALL USING (auth.role() = 'service_role');

-- #############################################################################
-- PARTE 3: GRANT PERMISSIONS
-- #############################################################################

GRANT SELECT ON sistemaretiradas.linx_microvix_config TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_parceiros TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_clientes TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_transacoes TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_campanhas TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_bonus TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_vendas TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_vendas_itens TO authenticated;
GRANT SELECT ON sistemaretiradas.linx_microvix_sync_log TO authenticated;

GRANT ALL ON sistemaretiradas.linx_microvix_config TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_parceiros TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_clientes TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_transacoes TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_campanhas TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_bonus TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_vendas TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_vendas_itens TO service_role;
GRANT ALL ON sistemaretiradas.linx_microvix_sync_log TO service_role;

-- #############################################################################
-- PARTE 4: VIEWS ÚTEIS
-- #############################################################################

-- View: Resumo de vendas por loja
CREATE OR REPLACE VIEW sistemaretiradas.vw_linx_microvix_vendas_resumo AS
SELECT 
    v.store_id,
    s.name as store_name,
    DATE_TRUNC('day', v.data_venda) as data,
    COUNT(*) as total_vendas,
    SUM(v.valor_liquido) as valor_total,
    COUNT(DISTINCT v.doc_cliente) as clientes_unicos,
    COUNT(DISTINCT v.cod_vendedor) as vendedores_ativos
FROM sistemaretiradas.linx_microvix_vendas v
JOIN sistemaretiradas.stores s ON s.id = v.store_id
WHERE v.cancelado = false
GROUP BY v.store_id, s.name, DATE_TRUNC('day', v.data_venda);

-- View: Resumo de fidelidade por loja
CREATE OR REPLACE VIEW sistemaretiradas.vw_linx_microvix_fidelidade_resumo AS
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

-- View: Status das integrações por loja
CREATE OR REPLACE VIEW sistemaretiradas.vw_linx_microvix_status AS
SELECT 
    cfg.store_id,
    s.name as store_name,
    cfg.cnpj,
    cfg.hub_active,
    cfg.hub_sync_status,
    cfg.hub_last_sync_at,
    cfg.ws_active,
    cfg.ws_sync_status,
    cfg.ws_last_sync_at,
    cfg.ws_last_timestamp,
    (SELECT COUNT(*) FROM sistemaretiradas.linx_microvix_vendas v WHERE v.store_id = cfg.store_id) as total_vendas,
    (SELECT COUNT(*) FROM sistemaretiradas.linx_microvix_clientes c WHERE c.store_id = cfg.store_id) as total_clientes_fidelidade
FROM sistemaretiradas.linx_microvix_config cfg
JOIN sistemaretiradas.stores s ON s.id = cfg.store_id
WHERE cfg.active = true;

-- #############################################################################
-- PARTE 5: FUNÇÕES ÚTEIS
-- #############################################################################

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

-- Função: Atualizar saldo do cliente
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
    
    IF NOT FOUND THEN
        INSERT INTO sistemaretiradas.linx_microvix_clientes (store_id, cpf, saldo_atual, saldo_disponivel, cliente_cadastrado)
        VALUES (p_store_id, p_cpf, p_saldo_atual, p_saldo_disponivel, true);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Atualizar timestamp após sync de vendas
CREATE OR REPLACE FUNCTION sistemaretiradas.update_linx_ws_timestamp(
    p_store_id UUID,
    p_new_timestamp BIGINT
)
RETURNS VOID AS $$
BEGIN
    UPDATE sistemaretiradas.linx_microvix_config
    SET 
        ws_last_timestamp = p_new_timestamp,
        ws_last_sync_at = NOW(),
        ws_sync_status = 'CONNECTED',
        ws_error_message = NULL,
        updated_at = NOW()
    WHERE store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Registrar log de sync
CREATE OR REPLACE FUNCTION sistemaretiradas.log_linx_sync(
    p_store_id UUID,
    p_tipo_sync VARCHAR(50),
    p_metodo VARCHAR(100),
    p_timestamp_inicio BIGINT,
    p_timestamp_fim BIGINT,
    p_registros_processados INTEGER,
    p_registros_inseridos INTEGER,
    p_registros_atualizados INTEGER,
    p_registros_erro INTEGER,
    p_status VARCHAR(20),
    p_error_message TEXT DEFAULT NULL,
    p_duracao_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO sistemaretiradas.linx_microvix_sync_log (
        store_id,
        tipo_sync,
        metodo,
        timestamp_inicio,
        timestamp_fim,
        registros_processados,
        registros_inseridos,
        registros_atualizados,
        registros_erro,
        status,
        error_message,
        duracao_ms,
        finished_at
    ) VALUES (
        p_store_id,
        p_tipo_sync,
        p_metodo,
        p_timestamp_inicio,
        p_timestamp_fim,
        p_registros_processados,
        p_registros_inseridos,
        p_registros_atualizados,
        p_registros_erro,
        p_status,
        p_error_message,
        p_duracao_ms,
        CASE WHEN p_status IN ('SUCCESS', 'ERROR') THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Upsert de venda
CREATE OR REPLACE FUNCTION sistemaretiradas.upsert_linx_venda(
    p_store_id UUID,
    p_id_transacao VARCHAR(100),
    p_numero_documento VARCHAR(50),
    p_serie_documento VARCHAR(10),
    p_tipo_movimento VARCHAR(50),
    p_cod_cliente VARCHAR(50),
    p_doc_cliente VARCHAR(20),
    p_nome_cliente VARCHAR(255),
    p_cod_vendedor VARCHAR(50),
    p_nome_vendedor VARCHAR(255),
    p_valor_bruto DECIMAL(15,2),
    p_valor_desconto DECIMAL(15,2),
    p_valor_liquido DECIMAL(15,2),
    p_valor_frete DECIMAL(15,2),
    p_data_venda TIMESTAMPTZ,
    p_data_emissao TIMESTAMPTZ,
    p_situacao VARCHAR(50),
    p_cancelado BOOLEAN,
    p_forma_pagamento VARCHAR(100),
    p_observacao TEXT,
    p_dados_originais JSONB,
    p_timestamp_linx BIGINT
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO sistemaretiradas.linx_microvix_vendas (
        store_id,
        id_transacao,
        numero_documento,
        serie_documento,
        tipo_movimento,
        cod_cliente,
        doc_cliente,
        nome_cliente,
        cod_vendedor,
        nome_vendedor,
        valor_bruto,
        valor_desconto,
        valor_liquido,
        valor_frete,
        data_venda,
        data_emissao,
        situacao,
        cancelado,
        forma_pagamento,
        observacao,
        dados_originais,
        timestamp_linx,
        synced_at
    ) VALUES (
        p_store_id,
        p_id_transacao,
        p_numero_documento,
        p_serie_documento,
        p_tipo_movimento,
        p_cod_cliente,
        p_doc_cliente,
        p_nome_cliente,
        p_cod_vendedor,
        p_nome_vendedor,
        p_valor_bruto,
        p_valor_desconto,
        p_valor_liquido,
        p_valor_frete,
        p_data_venda,
        p_data_emissao,
        p_situacao,
        p_cancelado,
        p_forma_pagamento,
        p_observacao,
        p_dados_originais,
        p_timestamp_linx,
        NOW()
    )
    ON CONFLICT (store_id, id_transacao) DO UPDATE SET
        numero_documento = EXCLUDED.numero_documento,
        serie_documento = EXCLUDED.serie_documento,
        tipo_movimento = EXCLUDED.tipo_movimento,
        cod_cliente = EXCLUDED.cod_cliente,
        doc_cliente = EXCLUDED.doc_cliente,
        nome_cliente = EXCLUDED.nome_cliente,
        cod_vendedor = EXCLUDED.cod_vendedor,
        nome_vendedor = EXCLUDED.nome_vendedor,
        valor_bruto = EXCLUDED.valor_bruto,
        valor_desconto = EXCLUDED.valor_desconto,
        valor_liquido = EXCLUDED.valor_liquido,
        valor_frete = EXCLUDED.valor_frete,
        data_venda = EXCLUDED.data_venda,
        data_emissao = EXCLUDED.data_emissao,
        situacao = EXCLUDED.situacao,
        cancelado = EXCLUDED.cancelado,
        forma_pagamento = EXCLUDED.forma_pagamento,
        observacao = EXCLUDED.observacao,
        dados_originais = EXCLUDED.dados_originais,
        timestamp_linx = EXCLUDED.timestamp_linx,
        synced_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- #############################################################################
-- PARTE 6: COMENTÁRIOS
-- #############################################################################

COMMENT ON TABLE sistemaretiradas.linx_microvix_config IS 'Configurações de integração Linx Microvix (Hub Fidelidade + WebService de Saída) por store_id';
COMMENT ON TABLE sistemaretiradas.linx_microvix_parceiros IS 'Cache de parceiros de fidelidade da Linx';
COMMENT ON TABLE sistemaretiradas.linx_microvix_clientes IS 'Clientes do Hub Fidelidade com saldo de pontos';
COMMENT ON TABLE sistemaretiradas.linx_microvix_transacoes IS 'Log de transações com o Hub Fidelidade';
COMMENT ON TABLE sistemaretiradas.linx_microvix_campanhas IS 'Campanhas de fidelidade ativas';
COMMENT ON TABLE sistemaretiradas.linx_microvix_bonus IS 'Histórico de bônus (geração, resgate, estorno)';
COMMENT ON TABLE sistemaretiradas.linx_microvix_vendas IS 'Vendas sincronizadas do WebService de Saída Microvix';
COMMENT ON TABLE sistemaretiradas.linx_microvix_vendas_itens IS 'Itens das vendas sincronizadas';
COMMENT ON TABLE sistemaretiradas.linx_microvix_sync_log IS 'Log de sincronizações do WebService';

-- =============================================================================
-- FIM DO SQL - Linx Microvix Integration (V2 - RLS Simplificado)
-- Cada loja (store_id) tem suas próprias credenciais Hub + WebService
-- =============================================================================
