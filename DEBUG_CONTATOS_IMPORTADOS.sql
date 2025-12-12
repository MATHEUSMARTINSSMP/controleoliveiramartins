-- Verificar contatos importados recentemente
SELECT 
    id,
    nome,
    cpf,
    telefone,
    store_id,
    created_at
FROM sistemaretiradas.crm_contacts
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Verificar total de contatos por store_id
SELECT 
    store_id,
    COUNT(*) as total
FROM sistemaretiradas.crm_contacts
GROUP BY store_id;

-- Verificar se os store_ids das lojas do admin existem
SELECT 
    s.id,
    s.name,
    s.admin_id,
    COUNT(c.id) as total_contatos
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.crm_contacts c ON c.store_id = s.id
WHERE s.admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
GROUP BY s.id, s.name, s.admin_id;
