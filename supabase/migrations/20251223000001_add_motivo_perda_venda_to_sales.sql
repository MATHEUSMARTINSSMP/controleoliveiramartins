-- ============================================================================
-- MIGRATION: Adicionar campo motivo_perda_venda à tabela sales
-- ============================================================================
-- Data: 2025-12-23
-- Descrição: Adiciona suporte para registrar motivo de perda de venda,
--            permitindo análise dos principais fatores que impactam as vendas.
--            Similar ao sistema ListaVez (listavez.com)
-- ============================================================================

-- 1. Adicionar coluna motivo_perda_venda (TEXT, opcional)
-- Armazena o motivo quando uma venda não foi concretizada
-- Exemplos: "Preço alto", "Não gostou do produto", "Sem estoque", etc.
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS motivo_perda_venda TEXT;

-- 2. Adicionar coluna venda_perdida (BOOLEAN, default false)
-- Flag para identificar rapidamente vendas perdidas
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS venda_perdida BOOLEAN NOT NULL DEFAULT false;

-- 3. Criar índice para busca rápida por venda_perdida
CREATE INDEX IF NOT EXISTS idx_sales_venda_perdida 
ON sistemaretiradas.sales(venda_perdida) 
WHERE venda_perdida = true;

-- 4. Criar índice para busca rápida por motivo_perda_venda
CREATE INDEX IF NOT EXISTS idx_sales_motivo_perda_venda 
ON sistemaretiradas.sales(motivo_perda_venda) 
WHERE motivo_perda_venda IS NOT NULL;

-- 5. Comentários
COMMENT ON COLUMN sistemaretiradas.sales.motivo_perda_venda IS 
'Motivo da perda de venda quando a venda não foi concretizada. NULL para vendas concluídas.';

COMMENT ON COLUMN sistemaretiradas.sales.venda_perdida IS 
'Flag que indica se a venda foi perdida (não concretizada). false = venda concluída, true = venda perdida.';

COMMENT ON INDEX sistemaretiradas.idx_sales_venda_perdida IS 
'Índice para busca rápida de vendas perdidas.';

COMMENT ON INDEX sistemaretiradas.idx_sales_motivo_perda_venda IS 
'Índice para busca rápida de vendas por motivo de perda.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

