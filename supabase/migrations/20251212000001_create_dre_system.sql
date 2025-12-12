-- ============================================================
-- MIGRATION: Sistema DRE (Demonstração do Resultado do Exercício)
-- Data: 2025-12-12
-- Descrição: Cria tabelas, categorias pré-programadas, RLS e triggers
-- ============================================================

-- ============================================================
-- 1. CRIAR TABELAS
-- ============================================================

-- Tabela: dre_categorias
CREATE TABLE IF NOT EXISTS sistemaretiradas.dre_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA', 'INVESTIMENTO')),
    descricao TEXT,
    ativo BOOLEAN DEFAULT true NOT NULL,
    ordem INTEGER DEFAULT 0 NOT NULL,
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraint: Categorias globais não podem ter store_id
    CONSTRAINT check_global_no_store CHECK (
        (is_global = true AND store_id IS NULL) OR
        (is_global = false AND store_id IS NOT NULL)
    )
);

-- Tabela: dre_lancamentos
CREATE TABLE IF NOT EXISTS sistemaretiradas.dre_lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID NOT NULL REFERENCES sistemaretiradas.dre_categorias(id) ON DELETE RESTRICT,
    descricao TEXT NOT NULL,
    valor NUMERIC(15,2) NOT NULL,
    competencia CHAR(6) NOT NULL, -- YYYYMM
    data_lancamento DATE NOT NULL,
    observacoes TEXT,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraint: Validar formato de competência
    CONSTRAINT check_competencia_format CHECK (competencia ~ '^[0-9]{6}$')
);

-- ============================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_competencia 
    ON sistemaretiradas.dre_lancamentos(competencia);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_store_id 
    ON sistemaretiradas.dre_lancamentos(store_id);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_categoria_id 
    ON sistemaretiradas.dre_lancamentos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_data_lancamento 
    ON sistemaretiradas.dre_lancamentos(data_lancamento);

CREATE INDEX IF NOT EXISTS idx_dre_categorias_store_id 
    ON sistemaretiradas.dre_categorias(store_id);

CREATE INDEX IF NOT EXISTS idx_dre_categorias_tipo 
    ON sistemaretiradas.dre_categorias(tipo);

CREATE INDEX IF NOT EXISTS idx_dre_categorias_ativo 
    ON sistemaretiradas.dre_categorias(ativo);

-- ============================================================
-- 3. SEED: CATEGORIAS PRÉ-PROGRAMADAS (GLOBAIS)
-- ============================================================

-- RECEITAS (4 categorias)
INSERT INTO sistemaretiradas.dre_categorias (nome, tipo, descricao, ordem, is_global) VALUES
('Vendas de Produtos', 'RECEITA', 'Receitas provenientes da venda de produtos', 1, true),
('Vendas de Serviços', 'RECEITA', 'Receitas provenientes da prestação de serviços', 2, true),
('Receitas Financeiras', 'RECEITA', 'Juros, rendimentos de aplicações financeiras', 3, true),
('Outras Receitas', 'RECEITA', 'Receitas diversas não classificadas nas categorias anteriores', 4, true)
ON CONFLICT DO NOTHING;

-- DESPESAS (11 categorias)
INSERT INTO sistemaretiradas.dre_categorias (nome, tipo, descricao, ordem, is_global) VALUES
('Custo de Mercadorias Vendidas (CMV)', 'DESPESA', 'Custo direto das mercadorias vendidas', 1, true),
('Despesas com Pessoal', 'DESPESA', 'Salários, encargos, benefícios, treinamentos', 2, true),
('Despesas Administrativas', 'DESPESA', 'Material de escritório, contabilidade, jurídico', 3, true),
('Despesas com Marketing', 'DESPESA', 'Publicidade, propaganda, marketing digital', 4, true),
('Despesas Financeiras', 'DESPESA', 'Juros, tarifas bancárias, IOF', 5, true),
('Impostos e Taxas', 'DESPESA', 'Impostos sobre vendas, taxas municipais, estaduais', 6, true),
('Aluguel', 'DESPESA', 'Aluguel de imóveis, equipamentos', 7, true),
('Energia e Água', 'DESPESA', 'Contas de luz, água, gás', 8, true),
('Telefone e Internet', 'DESPESA', 'Telefonia fixa, móvel, internet', 9, true),
('Manutenção', 'DESPESA', 'Manutenção de equipamentos, instalações', 10, true),
('Outras Despesas', 'DESPESA', 'Despesas diversas não classificadas', 11, true)
ON CONFLICT DO NOTHING;

-- INVESTIMENTOS (4 categorias)
INSERT INTO sistemaretiradas.dre_categorias (nome, tipo, descricao, ordem, is_global) VALUES
('Equipamentos', 'INVESTIMENTO', 'Aquisição de máquinas, equipamentos', 1, true),
('Tecnologia', 'INVESTIMENTO', 'Software, hardware, sistemas', 2, true),
('Infraestrutura', 'INVESTIMENTO', 'Reformas, ampliações, melhorias', 3, true),
('Capacitação', 'INVESTIMENTO', 'Cursos, treinamentos, desenvolvimento', 4, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. TRIGGERS: UPDATED_AT AUTOMÁTICO
-- ============================================================

-- Trigger para dre_categorias
CREATE OR REPLACE FUNCTION sistemaretiradas.update_dre_categorias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dre_categorias_updated_at
    BEFORE UPDATE ON sistemaretiradas.dre_categorias
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_dre_categorias_updated_at();

-- Trigger para dre_lancamentos
CREATE OR REPLACE FUNCTION sistemaretiradas.update_dre_lancamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dre_lancamentos_updated_at
    BEFORE UPDATE ON sistemaretiradas.dre_lancamentos
    FOR EACH ROW
    EXECUTE FUNCTION sistemaretiradas.update_dre_lancamentos_updated_at();

-- ============================================================
-- 5. RLS (ROW LEVEL SECURITY)
-- ============================================================

-- Habilitar RLS
ALTER TABLE sistemaretiradas.dre_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.dre_lancamentos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5.1 POLICIES: dre_categorias
-- ============================================================

-- Policy: Admins podem ler TODAS as categorias (globais + da loja)
CREATE POLICY "Admins podem ler todas as categorias DRE"
    ON sistemaretiradas.dre_categorias
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Policy: Admins podem criar categorias customizadas (não globais)
CREATE POLICY "Admins podem criar categorias DRE customizadas"
    ON sistemaretiradas.dre_categorias
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
        AND is_global = false
        AND store_id IS NOT NULL
    );

-- Policy: Admins podem atualizar categorias customizadas (não globais)
CREATE POLICY "Admins podem atualizar categorias DRE customizadas"
    ON sistemaretiradas.dre_categorias
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
        AND is_global = false
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
        AND is_global = false
    );

-- Policy: Admins podem deletar categorias customizadas (não globais, sem lançamentos)
CREATE POLICY "Admins podem deletar categorias DRE customizadas"
    ON sistemaretiradas.dre_categorias
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
        AND is_global = false
        AND NOT EXISTS (
            SELECT 1 FROM sistemaretiradas.dre_lancamentos
            WHERE dre_lancamentos.categoria_id = dre_categorias.id
        )
    );

-- ============================================================
-- 5.2 POLICIES: dre_lancamentos
-- ============================================================

-- Policy: Admins podem ler todos os lançamentos
CREATE POLICY "Admins podem ler todos os lançamentos DRE"
    ON sistemaretiradas.dre_lancamentos
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Policy: Admins podem criar lançamentos
CREATE POLICY "Admins podem criar lançamentos DRE"
    ON sistemaretiradas.dre_lancamentos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
        AND store_id IS NOT NULL
    );

-- Policy: Admins podem atualizar lançamentos
CREATE POLICY "Admins podem atualizar lançamentos DRE"
    ON sistemaretiradas.dre_lancamentos
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Policy: Admins podem deletar lançamentos
CREATE POLICY "Admins podem deletar lançamentos DRE"
    ON sistemaretiradas.dre_lancamentos
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM sistemaretiradas.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- ============================================================
-- 6. COMENTÁRIOS NAS TABELAS
-- ============================================================

COMMENT ON TABLE sistemaretiradas.dre_categorias IS 'Categorias para classificação de lançamentos DRE (Receitas, Despesas, Investimentos)';
COMMENT ON TABLE sistemaretiradas.dre_lancamentos IS 'Lançamentos financeiros do DRE (Demonstração do Resultado do Exercício)';

COMMENT ON COLUMN sistemaretiradas.dre_categorias.is_global IS 'true = Categoria pré-programada (global), false = Categoria customizada da loja';
COMMENT ON COLUMN sistemaretiradas.dre_lancamentos.competencia IS 'Período de competência no formato YYYYMM (ex: 202512)';
COMMENT ON COLUMN sistemaretiradas.dre_lancamentos.data_lancamento IS 'Data em que o lançamento foi realizado';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
