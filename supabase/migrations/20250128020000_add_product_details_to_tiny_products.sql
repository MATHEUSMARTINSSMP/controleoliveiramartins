-- =============================================================================
-- Migration: Adicionar campos de detalhes de produtos em tiny_products
-- Data: 2025-01-28
-- Descrição: Adiciona colunas para marca, subcategoria, tamanho, cor, etc.
--            Esses dados são extraídos via GET /produtos/{idProduto} da API Tiny
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar colunas de detalhes do produto
ALTER TABLE tiny_products
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS subcategoria TEXT,
  ADD COLUMN IF NOT EXISTS tamanho TEXT,
  ADD COLUMN IF NOT EXISTS cor TEXT,
  ADD COLUMN IF NOT EXISTS genero TEXT,
  ADD COLUMN IF NOT EXISTS faixa_etaria TEXT,
  ADD COLUMN IF NOT EXISTS material TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT; -- Descrição completa do produto

-- Adicionar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_tiny_products_marca ON tiny_products(marca) WHERE marca IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_products_subcategoria ON tiny_products(subcategoria) WHERE subcategoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_products_categoria ON tiny_products(categoria) WHERE categoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_products_tamanho ON tiny_products(tamanho) WHERE tamanho IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_products_cor ON tiny_products(cor) WHERE cor IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN tiny_products.marca IS 'Marca do produto (extraída de produto.marca.nome via GET /produtos/{id})';
COMMENT ON COLUMN tiny_products.subcategoria IS 'Subcategoria do produto (extraída de categoria.caminhoCompleto via GET /produtos/{id})';
COMMENT ON COLUMN tiny_products.tamanho IS 'Tamanho do produto (extraído de variacoes[].grade ou dados_extras)';
COMMENT ON COLUMN tiny_products.cor IS 'Cor do produto (extraída de variacoes[].grade ou dados_extras)';
COMMENT ON COLUMN tiny_products.genero IS 'Gênero do produto (extraído de variacoes[].grade ou dados_extras)';
COMMENT ON COLUMN tiny_products.faixa_etaria IS 'Faixa etária do produto (extraída de dados_extras)';
COMMENT ON COLUMN tiny_products.material IS 'Material do produto (extraído de dados_extras)';
COMMENT ON COLUMN tiny_products.descricao IS 'Descrição completa do produto (produto.descricao via API)';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

