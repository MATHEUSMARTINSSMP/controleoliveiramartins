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

-- =============================================================================
-- FIM DO SQL - Linx Microvix Integration
-- =============================================================================
