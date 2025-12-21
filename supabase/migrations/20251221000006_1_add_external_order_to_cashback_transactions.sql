-- =====================================================
-- ADICIONAR external_order_id E order_source EM cashback_transactions
-- =====================================================
-- Esta migration adiciona suporte multi-ERP na tabela cashback_transactions
-- Deve ser executada ANTES da fase 2
-- =====================================================

-- 1. Adicionar colunas external_order_id e order_source
DO $$ 
BEGIN
    -- external_order_id: ID do pedido no ERP externo (genérico)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions' 
        AND column_name = 'external_order_id'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_transactions
        ADD COLUMN external_order_id TEXT;
        
        RAISE NOTICE 'Coluna external_order_id adicionada em cashback_transactions';
    END IF;

    -- order_source: Origem do pedido (TINY, LINX, MICROVIX, etc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'cashback_transactions' 
        AND column_name = 'order_source'
    ) THEN
        ALTER TABLE sistemaretiradas.cashback_transactions
        ADD COLUMN order_source TEXT;
        
        RAISE NOTICE 'Coluna order_source adicionada em cashback_transactions';
    END IF;
END $$;

-- 2. Migrar dados existentes de tiny_order_id para external_order_id
-- Todos os registros existentes com tiny_order_id preenchido serão marcados como 'TINY'
UPDATE sistemaretiradas.cashback_transactions
SET 
    external_order_id = tiny_order_id::TEXT,
    order_source = 'TINY'
WHERE tiny_order_id IS NOT NULL
  AND (external_order_id IS NULL OR order_source IS NULL);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_external_order 
    ON sistemaretiradas.cashback_transactions(external_order_id, order_source)
    WHERE external_order_id IS NOT NULL;

-- 4. Comentários para documentação
COMMENT ON COLUMN sistemaretiradas.cashback_transactions.external_order_id IS 
'ID do pedido no ERP externo (genérico). Usado para TINY, LINX, MICROVIX e outros ERPs. Substitui tiny_order_id para suporte multi-ERP.';

COMMENT ON COLUMN sistemaretiradas.cashback_transactions.order_source IS 
'Origem do pedido externo: TINY, LINX, MICROVIX, etc. Usado em conjunto com external_order_id para identificar unicamente o pedido no ERP.';

