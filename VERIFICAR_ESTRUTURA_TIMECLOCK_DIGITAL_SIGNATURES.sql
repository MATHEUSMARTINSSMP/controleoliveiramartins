-- =====================================================
-- VERIFICAR ESTRUTURA REAL DA TABELA
-- =====================================================

-- Listar todas as colunas da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'time_clock_digital_signatures'
ORDER BY ordinal_position;

-- Verificar se existe signature_hash
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            AND column_name = 'signature_hash'
        ) THEN '✅ signature_hash EXISTE'
        ELSE '❌ signature_hash NÃO EXISTE'
    END AS status_signature_hash;

-- Verificar se existe password_hash
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'time_clock_digital_signatures'
            AND column_name = 'password_hash'
        ) THEN '✅ password_hash EXISTE'
        ELSE '❌ password_hash NÃO EXISTE'
    END AS status_password_hash;

