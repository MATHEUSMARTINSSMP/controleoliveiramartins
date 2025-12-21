-- =====================================================
-- SUPORTE GENÉRICO PARA MÚLTIPLOS ERPs
-- =====================================================
-- Ao invés de ter 50 colunas diferentes (tiny_order_id, linx_order_id, etc),
-- usamos uma estrutura normalizada:
-- - external_order_id: ID do pedido no ERP externo (genérico)
-- - order_source: Origem do pedido ('TINY', 'LINX', 'MICROVIX', etc)
-- =====================================================

-- 1. Adicionar colunas genéricas para suporte multi-ERP
DO $$ 
BEGIN
    -- external_order_id: ID do pedido no ERP externo (genérico)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'sales' 
        AND column_name = 'external_order_id'
    ) THEN
        ALTER TABLE sistemaretiradas.sales
        ADD COLUMN external_order_id TEXT;
        
        RAISE NOTICE 'Coluna external_order_id adicionada';
    END IF;

    -- order_source: Origem do pedido (TINY, LINX, MICROVIX, etc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'sales' 
        AND column_name = 'order_source'
    ) THEN
        ALTER TABLE sistemaretiradas.sales
        ADD COLUMN order_source TEXT;
        
        RAISE NOTICE 'Coluna order_source adicionada';
    END IF;
END $$;

-- 2. Migrar dados existentes de tiny_order_id para external_order_id
-- Todos os registros existentes com tiny_order_id preenchido serão marcados como 'TINY'
UPDATE sistemaretiradas.sales
SET 
    external_order_id = tiny_order_id::TEXT,
    order_source = 'TINY'
WHERE tiny_order_id IS NOT NULL
  AND (external_order_id IS NULL OR order_source IS NULL);

-- 3. Criar índice para performance (busca por external_order_id + order_source)
CREATE INDEX IF NOT EXISTS idx_sales_external_order 
    ON sistemaretiradas.sales(external_order_id, order_source)
    WHERE external_order_id IS NOT NULL;

-- 4. Criar índice único parcial para evitar duplicatas
-- Garante que não haverá dois pedidos do mesmo ERP externo gerando vendas duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_external_order_unique 
    ON sistemaretiradas.sales(external_order_id, order_source)
    WHERE external_order_id IS NOT NULL AND order_source IS NOT NULL;

-- 5. Criar função helper para buscar venda por pedido externo
CREATE OR REPLACE FUNCTION sistemaretiradas.get_sale_by_external_order(
    p_external_order_id TEXT,
    p_order_source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_sale_id UUID;
BEGIN
    SELECT id INTO v_sale_id
    FROM sistemaretiradas.sales
    WHERE external_order_id = p_external_order_id
      AND order_source = p_order_source
    LIMIT 1;
    
    RETURN v_sale_id;
END;
$$;

-- 6. Criar função helper para verificar se pedido externo já gerou venda
CREATE OR REPLACE FUNCTION sistemaretiradas.external_order_has_sale(
    p_external_order_id TEXT,
    p_order_source TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM sistemaretiradas.sales
        WHERE external_order_id = p_external_order_id
          AND order_source = p_order_source
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- 7. Criar view que unifica acesso (para compatibilidade com código legado)
CREATE OR REPLACE VIEW sistemaretiradas.sales_with_order_source AS
SELECT 
    s.*,
    -- Para compatibilidade: se order_source = 'TINY', retorna external_order_id como UUID
    CASE 
        WHEN s.order_source = 'TINY' AND s.external_order_id IS NOT NULL 
        THEN s.external_order_id::UUID 
        ELSE NULL 
    END AS tiny_order_id_compat
FROM sistemaretiradas.sales s;

-- 8. Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.sales.external_order_id IS 
'ID do pedido no ERP externo (genérico). Usado para TINY, LINX, MICROVIX e outros ERPs. Substitui múltiplas colunas específicas por ERP.';

COMMENT ON COLUMN sistemaretiradas.sales.order_source IS 
'Origem do pedido externo: TINY, LINX, MICROVIX, etc. Usado em conjunto com external_order_id para identificar unicamente o pedido no ERP.';

COMMENT ON INDEX sistemaretiradas.idx_sales_external_order_unique IS 
'Garante que cada pedido do ERP externo gere apenas uma venda (evita duplicatas). Usa external_order_id + order_source como chave única.';

COMMENT ON FUNCTION sistemaretiradas.get_sale_by_external_order IS 
'Busca o ID da venda relacionada a um pedido externo. Parâmetros: external_order_id (TEXT) e order_source (TEXT como TINY, LINX, etc).';

COMMENT ON FUNCTION sistemaretiradas.external_order_has_sale IS 
'Verifica se um pedido externo já gerou uma venda. Retorna TRUE se existe, FALSE caso contrário.';

-- 9. NOTA IMPORTANTE:
-- A coluna tiny_order_id será mantida por enquanto para compatibilidade,
-- mas o código deve migrar para usar external_order_id + order_source.
-- Quando todos os pontos do código estiverem usando a nova estrutura,
-- podemos marcar tiny_order_id como DEPRECATED e eventualmente removê-la.

