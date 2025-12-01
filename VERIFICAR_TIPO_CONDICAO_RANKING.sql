-- Verificar o tipo do campo condicao_ranking na tabela bonuses
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
  AND table_name = 'bonuses'
  AND column_name = 'condicao_ranking';

-- Verificar valores atuais no campo
SELECT 
    condicao_ranking,
    COUNT(*) as quantidade
FROM sistemaretiradas.bonuses
GROUP BY condicao_ranking
ORDER BY quantidade DESC;

