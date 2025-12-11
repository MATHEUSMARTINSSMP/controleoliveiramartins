-- =====================================================
-- SOLUÇÃO EXTREMA - POLÍTICAS MÁXIMO PERMISSIVAS
-- =====================================================
-- Remove TODAS as políticas e cria políticas que permitem TUDO para autenticados
-- Use apenas se nada mais funcionar

-- =====================================================
-- 1. TIME_CLOCK_RECORDS - PERMITIR TUDO PARA AUTENTICADOS
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_records ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
          AND tablename = 'time_clock_records'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.time_clock_records', r.policyname);
    END LOOP;
END $$;

-- Política PERMISSIVA: Qualquer usuário autenticado pode inserir
CREATE POLICY "allow_all_insert_authenticated" 
ON sistemaretiradas.time_clock_records
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política PERMISSIVA: Qualquer usuário autenticado pode ler
CREATE POLICY "allow_all_select_authenticated" 
ON sistemaretiradas.time_clock_records
FOR SELECT
TO authenticated
USING (true);

-- Política PERMISSIVA: Qualquer usuário autenticado pode atualizar
CREATE POLICY "allow_all_update_authenticated" 
ON sistemaretiradas.time_clock_records
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- 2. TIME_CLOCK_HOURS_BALANCE - PERMITIR TUDO PARA AUTENTICADOS
-- =====================================================
ALTER TABLE sistemaretiradas.time_clock_hours_balance ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
          AND tablename = 'time_clock_hours_balance'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.time_clock_hours_balance', r.policyname);
    END LOOP;
END $$;

-- Política PERMISSIVA: Qualquer usuário autenticado pode inserir
CREATE POLICY "allow_all_insert_authenticated" 
ON sistemaretiradas.time_clock_hours_balance
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política PERMISSIVA: Qualquer usuário autenticado pode ler
CREATE POLICY "allow_all_select_authenticated" 
ON sistemaretiradas.time_clock_hours_balance
FOR SELECT
TO authenticated
USING (true);

-- Política PERMISSIVA: Qualquer usuário autenticado pode atualizar
CREATE POLICY "allow_all_update_authenticated" 
ON sistemaretiradas.time_clock_hours_balance
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- 3. VERIFICAR POLÍTICAS CRIADAS
-- =====================================================
SELECT 
    'time_clock_records' as tabela,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_records'
UNION ALL
SELECT 
    'time_clock_hours_balance' as tabela,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'time_clock_hours_balance'
ORDER BY tabela, cmd, policyname;

