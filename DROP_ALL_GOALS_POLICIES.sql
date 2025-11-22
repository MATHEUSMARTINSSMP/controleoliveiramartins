-- Script para apagar TODAS as políticas da tabela goals manualmente
-- Use este script se quiser limpar antes de executar a migration

-- 1. Listar todas as políticas existentes
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
AND tablename = 'goals';

-- 2. Apagar TODAS as políticas dinamicamente
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Apagar todas as políticas da tabela goals
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'sistemaretiradas' 
        AND tablename = 'goals'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sistemaretiradas.goals', r.policyname);
        RAISE NOTICE 'Política apagada: %', r.policyname;
    END LOOP;
    
    RAISE NOTICE 'Todas as políticas foram apagadas!';
END $$;

-- 3. Verificar que não há mais políticas
SELECT 
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'sistemaretiradas' 
AND tablename = 'goals';

