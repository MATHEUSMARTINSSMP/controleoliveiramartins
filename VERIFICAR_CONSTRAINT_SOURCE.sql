-- Verificar constraint da coluna source
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'sistemaretiradas.contacts'::regclass
AND conname LIKE '%source%';

-- Verificar valores existentes de source na tabela contacts
SELECT DISTINCT source, COUNT(*) 
FROM sistemaretiradas.contacts 
WHERE source IS NOT NULL
GROUP BY source;
