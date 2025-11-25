-- =============================================================================
-- Migration: Adicionar campos para vendedora e último ID sincronizado
-- =============================================================================
-- Objetivo: Preparar para integração com cashback e metas
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar campo para última ID sincronizada (proteção extra)
DO $$
BEGIN
    -- último_tiny_id_sincronizado: ID do último pedido sincronizado
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'erp_sync_logs' 
        AND column_name = 'ultimo_tiny_id_sincronizado'
    ) THEN
        ALTER TABLE erp_sync_logs ADD COLUMN ultimo_tiny_id_sincronizado TEXT;
    END IF;
END $$;

-- Adicionar campo para vendedora/colaboradora em tiny_orders
DO $$
BEGIN
    -- colaboradora_id: FK para profiles (vendedora que fez a venda)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'colaboradora_id'
    ) THEN
        ALTER TABLE tiny_orders ADD COLUMN colaboradora_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    -- vendedor_tiny_id: ID do vendedor no Tiny ERP (para matching)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'vendedor_tiny_id'
    ) THEN
        ALTER TABLE tiny_orders ADD COLUMN vendedor_tiny_id TEXT;
    END IF;

    -- vendedor_tiny_nome: Nome do vendedor no Tiny (para referência)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'tiny_orders' 
        AND column_name = 'vendedor_tiny_nome'
    ) THEN
        ALTER TABLE tiny_orders ADD COLUMN vendedor_tiny_nome TEXT;
    END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tiny_orders_colaboradora ON tiny_orders(colaboradora_id) WHERE colaboradora_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiny_orders_vendedor_tiny ON tiny_orders(vendedor_tiny_id) WHERE vendedor_tiny_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_ultimo_id ON erp_sync_logs(ultimo_tiny_id_sincronizado) WHERE ultimo_tiny_id_sincronizado IS NOT NULL;

-- Comentários
COMMENT ON COLUMN tiny_orders.colaboradora_id IS 'FK para profiles - Vendedora que fez a venda (para cashback e metas)';
COMMENT ON COLUMN tiny_orders.vendedor_tiny_id IS 'ID do vendedor no Tiny ERP (para matching com colaboradora)';
COMMENT ON COLUMN tiny_orders.vendedor_tiny_nome IS 'Nome do vendedor no Tiny (para referência)';
COMMENT ON COLUMN erp_sync_logs.ultimo_tiny_id_sincronizado IS 'ID do último pedido sincronizado (proteção extra além da data)';

