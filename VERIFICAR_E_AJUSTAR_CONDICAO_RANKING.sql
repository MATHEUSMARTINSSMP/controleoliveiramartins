-- ============================================
-- VERIFICAR E AJUSTAR CAMPO condicao_ranking
-- ============================================

-- 1. Verificar o tipo atual do campo condicao_ranking
SELECT 
    column_name,
    data_type,
    udt_name,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'bonuses'
  AND column_name = 'condicao_ranking';

-- 2. Verificar valores atuais no campo
SELECT 
    condicao_ranking,
    COUNT(*) as quantidade,
    condicao_meta_tipo
FROM sistemaretiradas.bonuses
WHERE condicao_ranking IS NOT NULL
GROUP BY condicao_ranking, condicao_meta_tipo
ORDER BY quantidade DESC;

-- 3. Se o campo for INTEGER, precisamos alterá-lo para TEXT ou VARCHAR
--    para aceitar o valor "TODAS"
--    Execute apenas se o tipo atual for INTEGER:

-- ALTER TABLE sistemaretiradas.bonuses
-- ALTER COLUMN condicao_ranking TYPE TEXT USING 
--   CASE 
--     WHEN condicao_ranking IS NULL THEN NULL
--     ELSE condicao_ranking::TEXT
--   END;

-- 4. Verificar se há constraints que precisam ser removidas
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.bonuses'::regclass
  AND conname LIKE '%ranking%';

-- 5. Após alterar o tipo, verificar novamente
-- SELECT 
--     column_name,
--     data_type,
--     udt_name
-- FROM information_schema.columns
-- WHERE table_schema = 'sistemaretiradas'
--   AND table_name = 'bonuses'
--   AND column_name = 'condicao_ranking';

