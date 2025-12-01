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

-- 3. CRIAR CONSTRAINT UNIQUE (necessária para ON CONFLICT funcionar)
-- PostgreSQL requer uma constraint UNIQUE, não apenas um índice único
ALTER TABLE sistemaretiradas.sales
DROP CONSTRAINT IF EXISTS sales_tiny_order_id_unique;

ALTER TABLE sistemaretiradas.sales
ADD CONSTRAINT sales_tiny_order_id_unique 
UNIQUE (tiny_order_id)
WHERE tiny_order_id IS NOT NULL;

-- 4. VERIFICAR SE A CONSTRAINT FOI CRIADA
SELECT 
    '4. VERIFICAR CONSTRAINT' as verificacao,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.sales'::regclass
  AND conname = 'sales_tiny_order_id_unique';

-- 5. CRIAR ÍNDICE PARA PERFORMANCE (separado da constraint)
CREATE INDEX IF NOT EXISTS idx_sales_tiny_order_id 
ON sistemaretiradas.sales(tiny_order_id) 
WHERE tiny_order_id IS NOT NULL;

-- 6. ATUALIZAR A FUNÇÃO PARA USAR A CONSTRAINT
-- A função já está usando ON CONFLICT, mas precisa usar o nome da constraint
-- Isso será feito na migration

-- ============================================================================
-- ✅ CORREÇÃO APLICADA
-- ============================================================================
-- Agora a função criar_vendas_de_tiny_orders deve funcionar corretamente
-- Execute: SELECT * FROM sistemaretiradas.criar_vendas_de_tiny_orders(NULL, NULL);

