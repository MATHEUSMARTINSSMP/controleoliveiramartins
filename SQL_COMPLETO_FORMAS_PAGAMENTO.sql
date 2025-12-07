-- ============================================================================
-- SCRIPT COMPLETO: Adicionar colunas de Formas de Pagamento
-- EXECUTE NO SUPABASE SQL EDITOR
-- Data: 2024-12-07
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABELA SALES - Adicionar colunas
-- ============================================================================

-- Coluna forma_pagamento (TEXT) - para compatibilidade legado
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NULL;

-- Coluna formas_pagamento_json (JSONB) - para multiplas formas de pagamento
-- Estrutura esperada: [{"tipo": "CREDITO", "valor": 100.00, "parcelas": 3}, {"tipo": "PIX", "valor": 50.00}]
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS formas_pagamento_json JSONB NULL;

-- ============================================================================
-- PARTE 2: TABELA TINY_ORDERS - Adicionar colunas (se existir)
-- ============================================================================

DO $$
BEGIN
  -- Verificar se a tabela tiny_orders existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'tiny_orders'
  ) THEN
    -- Adicionar coluna forma_pagamento
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'tiny_orders' 
      AND column_name = 'forma_pagamento'
    ) THEN
      ALTER TABLE sistemaretiradas.tiny_orders 
      ADD COLUMN forma_pagamento TEXT NULL;
      RAISE NOTICE 'Coluna forma_pagamento adicionada a tiny_orders';
    END IF;
    
    -- Adicionar coluna formas_pagamento_json
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'tiny_orders' 
      AND column_name = 'formas_pagamento_json'
    ) THEN
      ALTER TABLE sistemaretiradas.tiny_orders 
      ADD COLUMN formas_pagamento_json JSONB NULL;
      RAISE NOTICE 'Coluna formas_pagamento_json adicionada a tiny_orders';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PARTE 3: VERIFICACAO - Confirmar que as colunas foram criadas
-- ============================================================================

SELECT 
  table_name as "Tabela",
  column_name as "Coluna",
  data_type as "Tipo",
  is_nullable as "Permite NULL"
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name IN ('sales', 'tiny_orders')
  AND column_name IN ('forma_pagamento', 'formas_pagamento_json')
ORDER BY table_name, column_name;

-- ============================================================================
-- PARTE 4: COMENTARIOS NAS COLUNAS (documentacao)
-- ============================================================================

COMMENT ON COLUMN sistemaretiradas.sales.forma_pagamento IS 
  'Forma de pagamento principal (legado). Valores: CREDITO, DEBITO, DINHEIRO, PIX, BOLETO';

COMMENT ON COLUMN sistemaretiradas.sales.formas_pagamento_json IS 
  'Array JSON com todas as formas de pagamento. Estrutura: [{"tipo": "CREDITO", "valor": 100.00, "parcelas": 3}]';

-- ============================================================================
-- SUCESSO! As colunas foram criadas.
-- Agora voce pode lancar vendas com formas de pagamento.
-- ============================================================================
