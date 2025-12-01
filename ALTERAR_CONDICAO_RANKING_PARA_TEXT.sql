-- ============================================
-- ALTERAR condicao_ranking PARA ACEITAR "TODAS"
-- ============================================
-- Este script altera o campo condicao_ranking de INTEGER para TEXT
-- para permitir o valor "TODAS" em gincanas semanais

-- 1. Verificar tipo atual
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'bonuses'
  AND column_name = 'condicao_ranking';

-- 2. Alterar o tipo do campo para TEXT (aceita strings e números)
ALTER TABLE sistemaretiradas.bonuses
ALTER COLUMN condicao_ranking TYPE TEXT USING 
  CASE 
    WHEN condicao_ranking IS NULL THEN NULL
    ELSE condicao_ranking::TEXT
  END;

-- 3. Verificar se a alteração foi aplicada
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'bonuses'
  AND column_name = 'condicao_ranking';

-- 4. Verificar valores após alteração
SELECT 
    condicao_ranking,
    COUNT(*) as quantidade
FROM sistemaretiradas.bonuses
GROUP BY condicao_ranking
ORDER BY quantidade DESC;

