-- Verificar se a coluna cpf existe na tabela crm_contacts
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
AND table_name = 'crm_contacts'
AND column_name = 'cpf';
