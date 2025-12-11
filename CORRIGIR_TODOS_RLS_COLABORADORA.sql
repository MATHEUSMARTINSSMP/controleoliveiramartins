-- =====================================================
-- CORRIGIR TODAS AS POLÍTICAS RLS PARA COLABORADORAS
-- =====================================================
-- Execute este script para corrigir todos os problemas de RLS de uma vez

-- =====================================================
-- 1. CORRIGIR time_clock_records (INSERT)
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;

CREATE POLICY "colaboradora_insert_records" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (
    colaboradora_id = auth.uid()
);

-- =====================================================
-- 2. CORRIGIR time_clock_hours_balance (INSERT)
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_hours_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_insert" ON sistemaretiradas.time_clock_hours_balance;

CREATE POLICY "time_clock_hours_balance_colaboradora_insert" 
ON sistemaretiradas.time_clock_hours_balance
FOR INSERT
TO authenticated
WITH CHECK (
    colaboradora_id = auth.uid()
);

-- =====================================================
-- 3. VERIFICAR POLÍTICAS CRIADAS
-- =====================================================
SELECT 
    'time_clock_records' as tabela,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_records'
  AND cmd = 'INSERT'
UNION ALL
SELECT 
    'time_clock_hours_balance' as tabela,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_hours_balance'
  AND cmd = 'INSERT'
ORDER BY tabela, policyname;

