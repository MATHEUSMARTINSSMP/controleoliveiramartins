-- =====================================================
-- SOLUÇÃO RÁPIDA E FLEXÍVEL PARA RLS
-- =====================================================
-- Remove TODAS as políticas restritivas e cria políticas muito permissivas
-- Execute este script para resolver o problema imediatamente

-- =====================================================
-- 1. TIME_CLOCK_RECORDS - REMOVER TODAS E CRIAR PERMISSIVA
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "colaboradora_insert_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_read_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "colaboradora_own_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "admin_store_records" ON sistemaretiradas.time_clock_records;
DROP POLICY IF EXISTS "loja_store_records" ON sistemaretiradas.time_clock_records;

-- Política PERMISSIVA para INSERT - apenas verifica que colaboradora_id = auth.uid()
CREATE POLICY "colaboradora_insert_records" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (colaboradora_id = auth.uid());

-- Política PERMISSIVA para SELECT - colaboradora vê seus próprios registros
CREATE POLICY "colaboradora_read_records" 
ON sistemaretiradas.time_clock_records
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política para ADMIN/LOJA verem registros da loja
CREATE POLICY "admin_loja_read_records" 
ON sistemaretiradas.time_clock_records
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' OR p.role = 'LOJA')
          AND p.is_active = true
    )
);

-- Política para ADMIN fazer tudo
CREATE POLICY "admin_all_records" 
ON sistemaretiradas.time_clock_records
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
    )
);

-- =====================================================
-- 2. TIME_CLOCK_HOURS_BALANCE - REMOVER TODAS E CRIAR PERMISSIVA
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_hours_balance ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "time_clock_hours_balance_admin_read" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_admin_write" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_read" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_colaboradora_insert" ON sistemaretiradas.time_clock_hours_balance;
DROP POLICY IF EXISTS "time_clock_hours_balance_loja_read" ON sistemaretiradas.time_clock_hours_balance;

-- Política PERMISSIVA para INSERT - apenas verifica que colaboradora_id = auth.uid()
CREATE POLICY "time_clock_hours_balance_colaboradora_insert" 
ON sistemaretiradas.time_clock_hours_balance
FOR INSERT
TO authenticated
WITH CHECK (colaboradora_id = auth.uid());

-- Política PERMISSIVA para SELECT - colaboradora vê seu próprio saldo
CREATE POLICY "time_clock_hours_balance_colaboradora_read" 
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (colaboradora_id = auth.uid());

-- Política para ADMIN/LOJA verem saldos
CREATE POLICY "time_clock_hours_balance_admin_loja_read" 
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' OR p.role = 'LOJA')
          AND p.is_active = true
    )
);

-- Política para ADMIN fazer tudo
CREATE POLICY "time_clock_hours_balance_admin_all" 
ON sistemaretiradas.time_clock_hours_balance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sistemaretiradas.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'ADMIN'
          AND p.is_active = true
    )
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
UNION ALL
SELECT 
    'time_clock_hours_balance' as tabela,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_hours_balance'
ORDER BY tabela, cmd, policyname;

