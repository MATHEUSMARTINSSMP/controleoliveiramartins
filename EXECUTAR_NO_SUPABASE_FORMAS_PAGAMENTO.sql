-- ============================================================================
-- EXECUTAR NO SUPABASE: Adicionar colunas para Formas de Pagamento
-- Data: 2024-12-07
-- ============================================================================

-- PASSO 1: Adicionar colunas na tabela SALES
DO $$
BEGIN
  -- Adicionar coluna forma_pagamento se nao existir (para compatibilidade)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE sistemaretiradas.sales 
    ADD COLUMN forma_pagamento TEXT NULL;
    
    RAISE NOTICE 'Coluna forma_pagamento adicionada a tabela sales';
  ELSE
    RAISE NOTICE 'Coluna forma_pagamento ja existe na tabela sales';
  END IF;
  
  -- Adicionar coluna formas_pagamento_json (JSONB para multiplas formas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'sales' 
    AND column_name = 'formas_pagamento_json'
  ) THEN
    ALTER TABLE sistemaretiradas.sales 
    ADD COLUMN formas_pagamento_json JSONB NULL;
    
    RAISE NOTICE 'Coluna formas_pagamento_json adicionada a tabela sales';
  ELSE
    RAISE NOTICE 'Coluna formas_pagamento_json ja existe na tabela sales';
  END IF;
END $$;

-- PASSO 2: Adicionar colunas na tabela TINY_ORDERS (se existir)
DO $$
BEGIN
  -- Verificar se a tabela tiny_orders existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'tiny_orders'
  ) THEN
    -- Adicionar coluna forma_pagamento se nao existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'tiny_orders' 
      AND column_name = 'forma_pagamento'
    ) THEN
      ALTER TABLE sistemaretiradas.tiny_orders 
      ADD COLUMN forma_pagamento TEXT NULL;
      
      RAISE NOTICE 'Coluna forma_pagamento adicionada a tabela tiny_orders';
    ELSE
      RAISE NOTICE 'Coluna forma_pagamento ja existe na tabela tiny_orders';
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
      
      RAISE NOTICE 'Coluna formas_pagamento_json adicionada a tabela tiny_orders';
    ELSE
      RAISE NOTICE 'Coluna formas_pagamento_json ja existe na tabela tiny_orders';
    END IF;
  ELSE
    RAISE NOTICE 'Tabela tiny_orders nao existe - pulando...';
  END IF;
END $$;

-- PASSO 3: Verificar se as colunas foram criadas
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name IN ('sales', 'tiny_orders')
  AND column_name IN ('forma_pagamento', 'formas_pagamento_json')
ORDER BY table_name, column_name;
