-- Script para forçar o PostgREST a reconhecer o schema
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se o schema está exposto
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'sacadaohboy-mrkitsch-loungerie';

-- 2. Verificar permissões do authenticator
SELECT 
  nspname as schema_name,
  has_schema_privilege('authenticator', nspname, 'USAGE') as has_usage,
  has_schema_privilege('authenticator', nspname, 'CREATE') as has_create
FROM pg_namespace
WHERE nspname = 'sacadaohboy-mrkitsch-loungerie';

-- 3. Garantir que o authenticator tem USAGE no schema
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticator;
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon;
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticated;
GRANT USAGE ON SCHEMA "sacadaohboy-mrkitsch-loungerie" TO service_role;

-- 4. Garantir que o authenticator tem permissões nas tabelas
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO service_role;

-- 5. Garantir permissões em sequências
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO service_role;

-- 6. Garantir permissões em funções
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sacadaohboy-mrkitsch-loungerie" TO service_role;

-- 7. Configurar permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON TABLES TO authenticator, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT ALL ON SEQUENCES TO authenticator, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sacadaohboy-mrkitsch-loungerie" 
  GRANT EXECUTE ON FUNCTIONS TO authenticator, anon, authenticated, service_role;

-- 8. FORÇAR O POSTGREST A RECARREGAR O CACHE DE SCHEMAS
-- Este é o comando mais importante - força o PostgREST a recarregar o cache
NOTIFY pgrst, 'reload schema';

-- 9. Verificar se a tabela profiles existe e está acessível
SELECT 
  table_schema,
  table_name,
  has_table_privilege('authenticator', table_schema||'.'||table_name, 'SELECT') as can_select
FROM information_schema.tables
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND table_name = 'profiles';

-- 10. Verificar se o PostgREST pode ver o schema
-- Execute este comando e verifique se retorna o schema
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('sacadaohboy-mrkitsch-loungerie', 'public', 'elevea')
ORDER BY schema_name;

