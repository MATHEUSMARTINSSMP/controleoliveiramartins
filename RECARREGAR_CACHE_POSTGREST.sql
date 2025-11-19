-- ============================================
-- RECARREGAR CACHE DO POSTGREST
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- para recarregar o cache de schema do PostgREST
-- ============================================

-- 1. Recarregar o cache de schema do PostgREST
-- Isso é necessário quando schemas são adicionados à lista de expostos
NOTIFY pgrst, 'reload schema';

-- 2. Verificar configuração do papel authenticator
-- O papel authenticator precisa ter o schema na lista de db_schemas
SELECT 
    rolname,
    rolconfig
FROM pg_roles
WHERE rolname = 'authenticator';

-- 3. Se necessário, atualizar a configuração do authenticator
-- (Execute apenas se o schema não estiver na lista acima)
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, sacadaohboy-mrkitsch-loungerie, elevea';

-- 4. Verificar se o schema está acessível
SELECT 
    schema_name,
    schema_owner
FROM information_schema.schemata
WHERE schema_name IN ('sacadaohboy-mrkitsch-loungerie', 'elevea', 'public')
ORDER BY schema_name;

-- 5. Verificar permissões do authenticator no schema
SELECT 
    nspname as schema_name,
    rolname as role_name,
    has_schema_privilege(rolname, nspname, 'USAGE') as has_usage
FROM pg_namespace
CROSS JOIN pg_roles
WHERE nspname = 'sacadaohboy-mrkitsch-loungerie'
  AND rolname = 'authenticator';

-- NOTA: Após executar o NOTIFY, aguarde alguns segundos para o PostgREST recarregar o cache.
-- Você pode verificar se funcionou testando uma query simples:
-- SELECT COUNT(*) FROM "sacadaohboy-mrkitsch-loungerie".profiles;

