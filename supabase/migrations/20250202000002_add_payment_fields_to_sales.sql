-- ============================================================================
-- Migration: Adicionar campos de forma de pagamento à tabela sales
-- Data: 2025-02-02
-- Descrição: Adiciona suporte a formas de pagamento nas vendas
-- ============================================================================

-- 1. Adicionar coluna forma_pagamento (TEXT, opcional)
-- Armazena a forma principal de pagamento (ex: "DINHEIRO", "CREDITO", "DEBITO", "PIX", etc.)
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- 2. Adicionar coluna formas_pagamento_json (JSONB, opcional)
-- Armazena todas as formas de pagamento em formato JSON para suportar múltiplas formas
-- Exemplo: [{"tipo": "CREDITO", "valor": 100.00, "parcelas": 2}, {"tipo": "PIX", "valor": 99.90}]
ALTER TABLE sistemaretiradas.sales
ADD COLUMN IF NOT EXISTS formas_pagamento_json JSONB;

-- 3. Criar índice para busca rápida por forma de pagamento
CREATE INDEX IF NOT EXISTS idx_sales_forma_pagamento 
ON sistemaretiradas.sales(forma_pagamento) 
WHERE forma_pagamento IS NOT NULL;

-- 4. Criar índice GIN para busca rápida em formas_pagamento_json
CREATE INDEX IF NOT EXISTS idx_sales_formas_pagamento_json 
ON sistemaretiradas.sales USING GIN (formas_pagamento_json) 
WHERE formas_pagamento_json IS NOT NULL;

-- 5. Comentários
COMMENT ON COLUMN sistemaretiradas.sales.forma_pagamento IS 
'Forma principal de pagamento da venda (ex: DINHEIRO, CREDITO, DEBITO, PIX, VALE_TROCA). NULL para vendas sem informação de pagamento.';

COMMENT ON COLUMN sistemaretiradas.sales.formas_pagamento_json IS 
'Array JSON com todas as formas de pagamento da venda. Permite múltiplas formas na mesma venda.
Formato: [{"tipo": "CREDITO", "valor": 100.00, "parcelas": 2}, {"tipo": "PIX", "valor": 99.90}]. NULL para vendas sem informação de pagamento.';

COMMENT ON INDEX sistemaretiradas.idx_sales_forma_pagamento IS 
'Índice para busca rápida de vendas por forma de pagamento principal.';

COMMENT ON INDEX sistemaretiradas.idx_sales_formas_pagamento_json IS 
'Índice GIN para busca eficiente em arrays JSON de formas de pagamento.';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

