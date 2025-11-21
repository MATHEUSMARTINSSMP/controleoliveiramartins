SELECT 
    i.relname as index_name, 
    array_to_string(array_agg(a.attname), ', ') as column_names,
    ix.indisunique as is_unique
FROM 
    pg_class t, 
    pg_class i, 
    pg_index ix, 
    pg_attribute a 
WHERE 
    t.oid = ix.indrelid 
    AND i.oid = ix.indexrelid 
    AND a.attrelid = t.oid 
    AND a.attnum = ANY(ix.indkey) 
    AND t.relkind = 'r' 
    AND t.relname = 'goals' 
    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sistemaretiradas')
GROUP BY 
    i.relname, 
    ix.indisunique;
