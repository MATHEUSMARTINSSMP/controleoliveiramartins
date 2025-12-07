-- ============================================================================
-- CORREÇÃO: Criar constraint UNIQUE para tiny_order_id (necessário para ON CONFLICT)
-- Execute este script para corrigir o problema
-- ============================================================================

-- 1. VERIFICAR SE O ÍNDICE ÚNICO EXISTE
SELECT 
    '1. VERIFICAR ÍNDICE' as verificacao,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'sales'
  AND indexname LIKE '%tiny_order_id%';

-- 2. REMOVER ÍNDICE ÚNICO EXISTENTE (se existir)
DROP INDEX IF EXISTS sistemaretiradas.idx_sales_tiny_order_id_unique;

-- 3. CRIAR ÍNDICE ÚNICO PARCIAL (necessário para ON CONFLICT funcionar)
-- PostgreSQL permite ON CONFLICT com índices únicos parciais
-- O WHERE já está no índice, então ON CONFLICT (tiny_order_id) funciona automaticamente
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tiny_order_id_unique 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- 4. VERIFICAR SE O ÍNDICE FOI CRIADO
SELECT 
    '4. VERIFICAR ÍNDICE' as verificacao,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'sales'
  AND indexname = 'idx_sales_tiny_order_id_unique';

-- 5. CRIAR ÍNDICE PARA PERFORMANCE (separado da constraint)
CREATE INDEX IF NOT EXISTS idx_sales_tiny_order_id 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- ============================================================================
-- ✅ CORREÇÃO APLICADA
-- ============================================================================
-- Agora a função criar_vendas_de_tiny_orders deve funcionar corretamente
-- O ON CONFLICT usa o nome do índice: idx_sales_tiny_order_id_unique
-- Execute: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

