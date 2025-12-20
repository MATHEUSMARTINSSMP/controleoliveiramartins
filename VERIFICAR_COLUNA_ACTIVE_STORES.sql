-- =====================================================
-- VERIFICAR COLUNA active/is_active NA TABELA stores
-- =====================================================

-- Verificar quais colunas existem na tabela stores relacionadas a active/is_active
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'stores'
  AND (column_name LIKE '%active%' OR column_name LIKE '%is_active%')
ORDER BY column_name;

-- Ver estrutura completa da tabela stores
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'stores'
ORDER BY ordinal_position;

