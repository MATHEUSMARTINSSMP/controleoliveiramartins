-- =============================================================================
-- FIX: Adicionar coluna colaboradora_id à tabela tiny_orders
-- =============================================================================
-- Erro: "Could not find the 'colaboradora_id' column of 'tiny_orders'"
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar coluna colaboradora_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'colaboradora_id'
    ) THEN
        ALTER TABLE tiny_orders 
        ADD COLUMN colaboradora_id UUID 
        REFERENCES profiles(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Coluna colaboradora_id adicionada à tabela tiny_orders';
    ELSE
        RAISE NOTICE 'Coluna colaboradora_id já existe na tabela tiny_orders';
    END IF;
END $$;

-- Adicionar vendedor_tiny_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'vendedor_tiny_id'
    ) THEN
        ALTER TABLE tiny_orders 
        ADD COLUMN vendedor_tiny_id TEXT;
        
        RAISE NOTICE 'Coluna vendedor_tiny_id adicionada à tabela tiny_orders';
    ELSE
        RAISE NOTICE 'Coluna vendedor_tiny_id já existe na tabela tiny_orders';
    END IF;
END $$;

-- Adicionar vendedor_tiny_nome se não existir (pode estar como vendedor_nome)
DO $$
BEGIN
    -- Verificar se existe como vendedor_nome primeiro
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'vendedor_nome'
    ) THEN
        RAISE NOTICE 'Coluna vendedor_nome já existe (será usada no lugar de vendedor_tiny_nome)';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'vendedor_tiny_nome'
    ) THEN
        ALTER TABLE tiny_orders 
        ADD COLUMN vendedor_tiny_nome TEXT;
        
        RAISE NOTICE 'Coluna vendedor_tiny_nome adicionada à tabela tiny_orders';
    ELSE
        RAISE NOTICE 'Coluna vendedor_tiny_nome já existe na tabela tiny_orders';
    END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tiny_orders_colaboradora 
ON tiny_orders(colaboradora_id) 
WHERE colaboradora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tiny_orders_vendedor_tiny 
ON tiny_orders(vendedor_tiny_id) 
WHERE vendedor_tiny_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN tiny_orders.colaboradora_id IS 'FK para profiles - Vendedora que fez a venda (para cashback e metas)';
COMMENT ON COLUMN tiny_orders.vendedor_tiny_id IS 'ID do vendedor no Tiny ERP (para matching com colaboradora)';
COMMENT ON COLUMN tiny_orders.vendedor_tiny_nome IS 'Nome do vendedor no Tiny (para referência)';

-- Verificar estrutura final
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'tiny_orders'
  AND column_name IN ('colaboradora_id', 'vendedor_tiny_id', 'vendedor_tiny_nome', 'vendedor_nome')
ORDER BY column_name;

-- =============================================================================
-- RESUMO
-- =============================================================================
-- ✅ Coluna colaboradora_id adicionada (se não existia)
-- ✅ Coluna vendedor_tiny_id adicionada (se não existia)
-- ✅ Coluna vendedor_tiny_nome adicionada (se não existia)
-- ✅ Índices criados para performance
-- =============================================================================

