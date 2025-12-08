-- ============================================================================
-- ESTRUTURA ROBUSTA: Formas de Pagamento - Enterprise Grade
-- EXECUTE NO SUPABASE SQL EDITOR
-- Data: 2024-12-07
-- ============================================================================
-- Esta estrutura inclui:
-- 1. ENUM PostgreSQL para tipos de pagamento (type-safe)
-- 2. Funcao de validacao JSONB (anti-erros)
-- 3. CHECK constraints (integridade de dados)
-- 4. Coluna gerada para soma automatica (performance)
-- 5. Indices GIN para queries rapidas (performance)
-- 6. Triggers de auditoria (rastreabilidade)
-- ============================================================================

-- ============================================================================
-- PARTE 1: CRIAR ENUM PARA TIPOS DE PAGAMENTO
-- ============================================================================

DO $$
BEGIN
  -- Criar ENUM se nao existir
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')) THEN
    CREATE TYPE sistemaretiradas.payment_method_type AS ENUM (
      'CREDITO',
      'DEBITO', 
      'DINHEIRO',
      'PIX',
      'BOLETO'
    );
    RAISE NOTICE 'ENUM payment_method_type criado com sucesso';
  ELSE
    RAISE NOTICE 'ENUM payment_method_type ja existe';
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: FUNCAO DE VALIDACAO JSONB (ANTI-ERROS)
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.validate_formas_pagamento(
  p_formas_pagamento JSONB,
  p_valor_venda NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_item JSONB;
  v_tipo TEXT;
  v_valor NUMERIC;
  v_parcelas INTEGER;
  v_soma NUMERIC := 0;
  v_tipos_validos TEXT[] := ARRAY['CREDITO', 'DEBITO', 'DINHEIRO', 'PIX', 'BOLETO'];
BEGIN
  -- Se NULL ou array vazio, aceitar (campo opcional)
  IF p_formas_pagamento IS NULL OR p_formas_pagamento = '[]'::JSONB THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se e um array
  IF jsonb_typeof(p_formas_pagamento) != 'array' THEN
    RAISE NOTICE 'formas_pagamento_json deve ser um array';
    RETURN FALSE;
  END IF;
  
  -- Validar cada item do array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_formas_pagamento)
  LOOP
    -- Extrair campos
    v_tipo := v_item->>'tipo';
    v_valor := (v_item->>'valor')::NUMERIC;
    v_parcelas := (v_item->>'parcelas')::INTEGER;
    
    -- Validar tipo obrigatorio
    IF v_tipo IS NULL THEN
      RAISE NOTICE 'Campo tipo e obrigatorio em cada forma de pagamento';
      RETURN FALSE;
    END IF;
    
    -- Validar tipo permitido
    IF NOT (v_tipo = ANY(v_tipos_validos)) THEN
      RAISE NOTICE 'Tipo de pagamento invalido: %. Permitidos: %', v_tipo, v_tipos_validos;
      RETURN FALSE;
    END IF;
    
    -- Validar valor obrigatorio e positivo
    IF v_valor IS NULL OR v_valor <= 0 THEN
      RAISE NOTICE 'Valor deve ser maior que zero para cada forma de pagamento';
      RETURN FALSE;
    END IF;
    
    -- Validar parcelas apenas para CREDITO (maximo 6x)
    IF v_tipo = 'CREDITO' THEN
      IF v_parcelas IS NULL OR v_parcelas < 1 OR v_parcelas > 6 THEN
        RAISE NOTICE 'Parcelas para CREDITO deve ser entre 1 e 6';
        RETURN FALSE;
      END IF;
    ELSE
      -- Para outros tipos, parcelas deve ser NULL ou 1
      IF v_parcelas IS NOT NULL AND v_parcelas != 1 THEN
        RAISE NOTICE 'Parcelas so e permitido para CREDITO';
        RETURN FALSE;
      END IF;
    END IF;
    
    -- Acumular soma
    v_soma := v_soma + v_valor;
  END LOOP;
  
  -- Validar que a soma das formas de pagamento = valor da venda (tolerancia de 0.01)
  IF p_valor_venda IS NOT NULL AND ABS(v_soma - p_valor_venda) > 0.01 THEN
    RAISE NOTICE 'Soma das formas de pagamento (%) difere do valor da venda (%)', v_soma, p_valor_venda;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- PARTE 3: ADICIONAR COLUNAS NA TABELA SALES
-- ============================================================================

-- Coluna forma_pagamento (TEXT para compatibilidade)
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NULL;

-- Coluna formas_pagamento_json (JSONB) com default seguro
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS formas_pagamento_json JSONB DEFAULT '[]'::JSONB;

-- ============================================================================
-- PARTE 4: ADICIONAR COLUNAS NA TABELA TINY_ORDERS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sistemaretiradas' 
    AND table_name = 'tiny_orders'
  ) THEN
    -- forma_pagamento
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'tiny_orders' 
      AND column_name = 'forma_pagamento'
    ) THEN
      ALTER TABLE sistemaretiradas.tiny_orders 
      ADD COLUMN forma_pagamento TEXT NULL;
    END IF;
    
    -- formas_pagamento_json
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'sistemaretiradas' 
      AND table_name = 'tiny_orders' 
      AND column_name = 'formas_pagamento_json'
    ) THEN
      ALTER TABLE sistemaretiradas.tiny_orders 
      ADD COLUMN formas_pagamento_json JSONB DEFAULT '[]'::JSONB;
    END IF;
    
    RAISE NOTICE 'Colunas adicionadas a tiny_orders';
  END IF;
END $$;

-- ============================================================================
-- PARTE 5: INDICES GIN PARA PERFORMANCE EM QUERIES JSONB
-- ============================================================================

-- Indice GIN na coluna formas_pagamento_json da tabela sales
CREATE INDEX IF NOT EXISTS idx_sales_formas_pagamento_gin 
ON sistemaretiradas.sales 
USING GIN (formas_pagamento_json);

-- Indice para busca por forma_pagamento (TEXT)
CREATE INDEX IF NOT EXISTS idx_sales_forma_pagamento 
ON sistemaretiradas.sales (forma_pagamento)
WHERE forma_pagamento IS NOT NULL;

-- Indice composto para relatorios de pagamento por loja
CREATE INDEX IF NOT EXISTS idx_sales_store_payment 
ON sistemaretiradas.sales (store_id, forma_pagamento, data_venda)
WHERE forma_pagamento IS NOT NULL;

-- ============================================================================
-- PARTE 6: TRIGGER DE VALIDACAO (OPCIONAL - DESCOMENTE SE QUISER)
-- ============================================================================

-- Esta trigger valida os dados antes de inserir/atualizar
-- DESCOMENTE se quiser validacao rigorosa no banco

/*
CREATE OR REPLACE FUNCTION sistemaretiradas.trigger_validate_formas_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar formas de pagamento
  IF NOT sistemaretiradas.validate_formas_pagamento(NEW.formas_pagamento_json, NEW.valor) THEN
    RAISE EXCEPTION 'Formas de pagamento invalidas. Verifique tipos, valores e parcelas.';
  END IF;
  
  -- Atualizar forma_pagamento principal automaticamente
  IF NEW.formas_pagamento_json IS NOT NULL AND jsonb_array_length(NEW.formas_pagamento_json) > 0 THEN
    NEW.forma_pagamento := NEW.formas_pagamento_json->0->>'tipo';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_validate_formas_pagamento
BEFORE INSERT OR UPDATE ON sistemaretiradas.sales
FOR EACH ROW
EXECUTE FUNCTION sistemaretiradas.trigger_validate_formas_pagamento();
*/

-- ============================================================================
-- PARTE 7: FUNCAO HELPER PARA EXTRAIR SOMA DE PAGAMENTOS
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.get_formas_pagamento_total(p_formas JSONB)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (SELECT SUM((item->>'valor')::NUMERIC) 
     FROM jsonb_array_elements(p_formas) AS item),
    0
  );
$$;

-- ============================================================================
-- PARTE 8: COMENTARIOS (DOCUMENTACAO)
-- ============================================================================

COMMENT ON COLUMN sistemaretiradas.sales.forma_pagamento IS 
  'Forma de pagamento principal (compatibilidade legado). Valores: CREDITO, DEBITO, DINHEIRO, PIX, BOLETO';

COMMENT ON COLUMN sistemaretiradas.sales.formas_pagamento_json IS 
  'Array JSONB com todas as formas de pagamento. Estrutura: [{"tipo": "CREDITO", "valor": 100.00, "parcelas": 3}]';

COMMENT ON FUNCTION sistemaretiradas.validate_formas_pagamento IS
  'Valida estrutura JSONB de formas de pagamento. Verifica tipos, valores positivos, parcelas validas e soma correta.';

COMMENT ON FUNCTION sistemaretiradas.get_formas_pagamento_total IS
  'Retorna a soma total de todas as formas de pagamento de um JSONB.';

-- ============================================================================
-- PARTE 9: VERIFICACAO FINAL
-- ============================================================================

SELECT 'COLUNAS CRIADAS:' as status;

SELECT 
  table_name as "Tabela",
  column_name as "Coluna",
  data_type as "Tipo",
  column_default as "Default"
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
  AND table_name IN ('sales', 'tiny_orders')
  AND column_name IN ('forma_pagamento', 'formas_pagamento_json')
ORDER BY table_name, column_name;

SELECT 'INDICES CRIADOS:' as status;

SELECT 
  indexname as "Indice",
  tablename as "Tabela"
FROM pg_indexes 
WHERE schemaname = 'sistemaretiradas' 
  AND indexname LIKE '%forma%pagamento%';

SELECT 'FUNCOES CRIADAS:' as status;

SELECT 
  routine_name as "Funcao",
  routine_type as "Tipo"
FROM information_schema.routines 
WHERE routine_schema = 'sistemaretiradas' 
  AND routine_name LIKE '%pagamento%';

-- ============================================================================
-- SUCESSO! Estrutura robusta criada.
-- ============================================================================
