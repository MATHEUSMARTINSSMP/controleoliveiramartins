-- ============================================================================
-- ADICIONAR COLUNA tiny_contact_id NA TABELA sales (OPCIONAL)
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- 1. Adicionar a coluna tiny_contact_id (opcional/nullable)
ALTER TABLE sistemaretiradas.sales 
ADD COLUMN IF NOT EXISTS tiny_contact_id UUID NULL;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN sistemaretiradas.sales.tiny_contact_id IS 
'ID do contato no Tiny ERP (opcional, para rastreabilidade)';

-- 3. Criar índice para performance em buscas
CREATE INDEX IF NOT EXISTS idx_sales_tiny_contact_id 
ON sistemaretiradas.sales(tiny_contact_id) 
WHERE tiny_contact_id IS NOT NULL;

-- 4. Atualizar vendas existentes com o contact_id do pedido
UPDATE sistemaretiradas.sales s
SET tiny_contact_id = o.tiny_contact_id
FROM sistemaretiradas.tiny_orders o
WHERE s.tiny_order_id = o.id
  AND s.tiny_contact_id IS NULL
  AND o.tiny_contact_id IS NOT NULL;

-- 5. Verificar quantas vendas foram atualizadas
SELECT 
  COUNT(*) as total_vendas,
  COUNT(tiny_contact_id) as com_contact_id,
  COUNT(*) - COUNT(tiny_contact_id) as sem_contact_id
FROM sistemaretiradas.sales;
