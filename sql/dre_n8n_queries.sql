-- =============================================================================
-- QUERIES SQL PARA N8N - SISTEMA DRE (Demonstração do Resultado do Exercício)
-- Schema: sistemaretiradas
-- =============================================================================

-- =============================================================================
-- 1. CRIAR TABELAS DRE (se não existirem)
-- =============================================================================

-- Tabela de Categorias DRE
CREATE TABLE IF NOT EXISTS sistemaretiradas.dre_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA', 'INVESTIMENTO')),
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    store_id UUID REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Lançamentos DRE
CREATE TABLE IF NOT EXISTS sistemaretiradas.dre_lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID NOT NULL REFERENCES sistemaretiradas.dre_categorias(id) ON DELETE RESTRICT,
    descricao VARCHAR(500) NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    competencia VARCHAR(6) NOT NULL, -- YYYYMM (ex: 202512)
    data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
    observacoes TEXT,
    store_id UUID NOT NULL REFERENCES sistemaretiradas.stores(id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_store ON sistemaretiradas.dre_lancamentos(store_id);
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_competencia ON sistemaretiradas.dre_lancamentos(competencia);
CREATE INDEX IF NOT EXISTS idx_dre_lancamentos_categoria ON sistemaretiradas.dre_lancamentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_dre_categorias_store ON sistemaretiradas.dre_categorias(store_id);
CREATE INDEX IF NOT EXISTS idx_dre_categorias_tipo ON sistemaretiradas.dre_categorias(tipo);

-- =============================================================================
-- 2. INSERIR CATEGORIAS PADRÃO GLOBAIS
-- =============================================================================

INSERT INTO sistemaretiradas.dre_categorias (nome, tipo, descricao, ordem, ativo, is_global) VALUES
-- RECEITAS
('Vendas de Produtos', 'RECEITA', 'Receita com vendas de produtos', 1, true, true),
('Vendas de Serviços', 'RECEITA', 'Receita com prestação de serviços', 2, true, true),
('Outras Receitas', 'RECEITA', 'Outras receitas operacionais', 3, true, true),
('Receitas Financeiras', 'RECEITA', 'Juros, rendimentos e ganhos financeiros', 4, true, true),

-- DESPESAS
('Custo das Mercadorias Vendidas (CMV)', 'DESPESA', 'Custo de aquisição dos produtos vendidos', 10, true, true),
('Salários e Encargos', 'DESPESA', 'Folha de pagamento, INSS, FGTS, férias', 11, true, true),
('Aluguel', 'DESPESA', 'Aluguel do ponto comercial', 12, true, true),
('Energia Elétrica', 'DESPESA', 'Conta de luz', 13, true, true),
('Água e Esgoto', 'DESPESA', 'Conta de água', 14, true, true),
('Telefone e Internet', 'DESPESA', 'Comunicações', 15, true, true),
('Marketing e Publicidade', 'DESPESA', 'Gastos com divulgação e propaganda', 16, true, true),
('Manutenção e Reparos', 'DESPESA', 'Manutenção de equipamentos e instalações', 17, true, true),
('Material de Escritório', 'DESPESA', 'Papelaria e materiais administrativos', 18, true, true),
('Taxas de Cartão', 'DESPESA', 'Taxas de maquininhas e operadoras', 19, true, true),
('Impostos', 'DESPESA', 'Impostos sobre vendas (exceto IR/CSLL)', 20, true, true),
('Despesas Financeiras', 'DESPESA', 'Juros, tarifas bancárias, IOF', 21, true, true),
('Frete e Entregas', 'DESPESA', 'Custos de transporte e logística', 22, true, true),
('Outras Despesas', 'DESPESA', 'Despesas diversas não classificadas', 23, true, true),

-- INVESTIMENTOS
('Equipamentos', 'INVESTIMENTO', 'Compra de equipamentos e máquinas', 30, true, true),
('Reformas e Melhorias', 'INVESTIMENTO', 'Investimentos em infraestrutura', 31, true, true),
('Tecnologia', 'INVESTIMENTO', 'Sistemas, software e hardware', 32, true, true),
('Treinamentos', 'INVESTIMENTO', 'Capacitação de equipe', 33, true, true),
('Outros Investimentos', 'INVESTIMENTO', 'Investimentos diversos', 34, true, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. QUERIES PARA N8N - GET LANÇAMENTOS
-- =============================================================================

-- Query para buscar lançamentos (use no N8N Postgres node)
-- Parâmetros: $1=site_slug, $2=categoria_id, $3=competencia, $4=pesquisa
/*
SELECT 
    l.*,
    c.nome AS categoria_nome,
    c.tipo AS categoria_tipo,
    col.name AS created_by_name
FROM sistemaretiradas.dre_lancamentos l
LEFT JOIN sistemaretiradas.dre_categorias c ON l.categoria_id = c.id
LEFT JOIN sistemaretiradas.collaborators col ON l.created_by_id = col.user_id
INNER JOIN sistemaretiradas.stores s ON l.store_id = s.id
WHERE 
    ($1::text = '' OR s.site_slug = $1)
    AND ($2::uuid IS NULL OR l.categoria_id = $2)
    AND ($3::text = '' OR l.competencia = $3)
    AND ($4::text = '' OR l.descricao ILIKE '%' || $4 || '%')
ORDER BY l.competencia DESC, l.data_lancamento DESC;
*/

-- =============================================================================
-- 4. QUERIES PARA N8N - GET CATEGORIAS
-- =============================================================================

-- Query para buscar categorias (use no N8N Postgres node)
-- Parâmetros: $1=store_id (do CONVERT SITE SLUG TO STORE ID)
/*
SELECT c.id, c.nome, c.tipo, c.descricao, c.ordem, c.ativo, c.is_global
FROM sistemaretiradas.dre_categorias c
WHERE c.ativo = true 
  AND (c.is_global = true OR c.store_id = $1::uuid)
ORDER BY c.tipo, c.ordem, c.nome;
*/

-- =============================================================================
-- 5. QUERIES PARA N8N - POST LANÇAMENTO (Manual)
-- =============================================================================

-- Query para inserir lançamento manual
-- Parâmetros: $1=categoria_id, $2=descricao, $3=valor, $4=competencia, 
--             $5=data_lancamento, $6=observacoes, $7=store_id, $8=created_by_id
/*
INSERT INTO sistemaretiradas.dre_lancamentos 
    (categoria_id, descricao, valor, competencia, data_lancamento, observacoes, store_id, created_by_id) 
VALUES 
    ($1::uuid, $2, $3::decimal, $4, COALESCE($5::date, CURRENT_DATE), $6, $7::uuid, $8::uuid) 
RETURNING *;
*/

-- =============================================================================
-- 6. QUERIES PARA N8N - POST LANÇAMENTO (IA)
-- =============================================================================

-- Mesmo INSERT acima, mas os dados vêm processados pela IA

-- =============================================================================
-- 7. QUERIES PARA N8N - PUT LANÇAMENTO
-- =============================================================================

-- Query para atualizar lançamento
-- Parâmetros: $1=categoria_id, $2=descricao, $3=valor, $4=competencia, $5=observacoes, $6=id
/*
UPDATE sistemaretiradas.dre_lancamentos 
SET 
    categoria_id = COALESCE($1::uuid, categoria_id),
    descricao = COALESCE($2, descricao),
    valor = COALESCE($3::decimal, valor),
    competencia = COALESCE($4, competencia),
    observacoes = COALESCE($5, observacoes),
    updated_at = NOW()
WHERE id = $6::uuid
RETURNING *;
*/

-- =============================================================================
-- 8. QUERIES PARA N8N - DELETE LANÇAMENTO
-- =============================================================================

-- Query para deletar lançamento
-- Parâmetro: $1=id
/*
DELETE FROM sistemaretiradas.dre_lancamentos 
WHERE id = $1::uuid 
RETURNING id;
*/

-- =============================================================================
-- 9. FUNÇÃO AUXILIAR: CONVERTER SITE_SLUG PARA STORE_ID
-- =============================================================================

-- Use esta query ANTES de qualquer operação que precise do store_id
-- Parâmetro: $1=site_slug
/*
SELECT id AS store_id 
FROM sistemaretiradas.stores 
WHERE site_slug = $1
LIMIT 1;
*/

-- =============================================================================
-- 10. RLS (Row Level Security) - Opcional
-- =============================================================================

-- Habilitar RLS nas tabelas DRE
ALTER TABLE sistemaretiradas.dre_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE sistemaretiradas.dre_lancamentos ENABLE ROW LEVEL SECURITY;

-- Política para categorias (visualização)
DROP POLICY IF EXISTS dre_categorias_select_policy ON sistemaretiradas.dre_categorias;
CREATE POLICY dre_categorias_select_policy ON sistemaretiradas.dre_categorias
    FOR SELECT USING (
        is_global = true 
        OR store_id IN (
            SELECT store_id FROM sistemaretiradas.collaborators 
            WHERE user_id = auth.uid()
        )
    );

-- Política para lançamentos (visualização)
DROP POLICY IF EXISTS dre_lancamentos_select_policy ON sistemaretiradas.dre_lancamentos;
CREATE POLICY dre_lancamentos_select_policy ON sistemaretiradas.dre_lancamentos
    FOR SELECT USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.collaborators 
            WHERE user_id = auth.uid()
        )
    );

-- Política para lançamentos (inserção)
DROP POLICY IF EXISTS dre_lancamentos_insert_policy ON sistemaretiradas.dre_lancamentos;
CREATE POLICY dre_lancamentos_insert_policy ON sistemaretiradas.dre_lancamentos
    FOR INSERT WITH CHECK (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.collaborators 
            WHERE user_id = auth.uid()
        )
    );

-- Política para lançamentos (atualização)
DROP POLICY IF EXISTS dre_lancamentos_update_policy ON sistemaretiradas.dre_lancamentos;
CREATE POLICY dre_lancamentos_update_policy ON sistemaretiradas.dre_lancamentos
    FOR UPDATE USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.collaborators 
            WHERE user_id = auth.uid()
        )
    );

-- Política para lançamentos (deleção)
DROP POLICY IF EXISTS dre_lancamentos_delete_policy ON sistemaretiradas.dre_lancamentos;
CREATE POLICY dre_lancamentos_delete_policy ON sistemaretiradas.dre_lancamentos
    FOR DELETE USING (
        store_id IN (
            SELECT store_id FROM sistemaretiradas.collaborators 
            WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- FIM DO ARQUIVO
-- =============================================================================
