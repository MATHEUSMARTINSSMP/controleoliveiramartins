-- Script para recarregar o schema cache do PostgREST
-- Execute isso no Supabase SQL Editor após aplicar a migration

-- Verificar se a coluna cpf existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'sistemaretiradas'
AND table_name = 'crm_contacts'
AND column_name = 'cpf';

-- Notificar o PostgREST para recarregar o schema
-- No Supabase, isso geralmente é feito automaticamente, mas podemos forçar:
NOTIFY pgrst, 'reload schema';

-- Verificar a estrutura completa da tabela
\d sistemaretiradas.crm_contacts;
