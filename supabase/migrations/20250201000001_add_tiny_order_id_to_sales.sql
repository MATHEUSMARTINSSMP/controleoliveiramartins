-- ============================================================================
-- Migration: Adicionar tiny_order_id na tabela sales
-- Data: 2025-02-01
-- Descrição: Permite linkar vendas com pedidos do Tiny ERP
-- ============================================================================

-- 1. Adicionar coluna tiny_order_id
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS tiny_order_id UUID REFERENCES sistemaretiradas.tiny_orders(id) ON DELETE SET NULL;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_sales_tiny_order_id 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- 3. Criar índice único para evitar duplicatas (um pedido = uma venda)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tiny_order_id_unique 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- Comentários
COMMENT ON COLUMN sistemaretiradas.sales.tiny_order_id IS 
'ID do pedido do Tiny ERP que originou esta venda. NULL para vendas manuais.';

COMMENT ON INDEX sistemaretiradas.idx_sales_tiny_order_id IS 
'Índice para busca rápida de vendas por pedido do Tiny ERP.';

COMMENT ON INDEX sistemaretiradas.idx_sales_tiny_order_id_unique IS 
'Garante que cada pedido do Tiny ERP gere apenas uma venda (evita duplicatas).';

-- ============================================================================
-- ✅ MIGRATION COMPLETA
-- ============================================================================

