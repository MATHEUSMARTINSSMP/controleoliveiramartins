-- Script para RENOMEAR o schema de 'sacadaohboy-mrkitsch-loungerie' para 'sistemaretiradas'
-- Execute este script no SQL Editor do Supabase
-- ⚠️ ATENÇÃO: Este script renomeia o schema e todas as referências

-- 1. Renomear o schema
ALTER SCHEMA "sacadaohboy-mrkitsch-loungerie" RENAME TO "sistemaretiradas";

-- 2. Atualizar permissões do authenticator para o novo nome
GRANT USAGE ON SCHEMA "sistemaretiradas" TO authenticator;
GRANT USAGE ON SCHEMA "sistemaretiradas" TO anon;
GRANT USAGE ON SCHEMA "sistemaretiradas" TO authenticated;
GRANT USAGE ON SCHEMA "sistemaretiradas" TO service_role;

-- 3. Garantir permissões nas tabelas
GRANT ALL ON ALL TABLES IN SCHEMA "sistemaretiradas" TO authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA "sistemaretiradas" TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA "sistemaretiradas" TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA "sistemaretiradas" TO service_role;

-- 4. Garantir permissões em sequências
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sistemaretiradas" TO authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sistemaretiradas" TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sistemaretiradas" TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "sistemaretiradas" TO service_role;

-- 5. Garantir permissões em funções
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sistemaretiradas" TO authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sistemaretiradas" TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sistemaretiradas" TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "sistemaretiradas" TO service_role;

-- 6. Configurar permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA "sistemaretiradas" 
  GRANT ALL ON TABLES TO authenticator, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sistemaretiradas" 
  GRANT ALL ON SEQUENCES TO authenticator, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA "sistemaretiradas" 
  GRANT EXECUTE ON FUNCTIONS TO authenticator, anon, authenticated, service_role;

-- 7. CONFIGURAR O AUTHENTICATOR PARA RECONHECER O NOVO SCHEMA
-- Este é CRÍTICO: o PostgREST usa o papel authenticator para conectar
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, sistemaretiradas, elevea';

-- 8. FORÇAR O POSTGREST A RECARREGAR O CACHE DE SCHEMAS
NOTIFY pgrst, 'reload schema';

-- 9. Verificar se o schema foi renomeado corretamente
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'sistemaretiradas';

-- 10. Verificar se as tabelas estão no novo schema
SELECT 
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'sistemaretiradas'
ORDER BY table_name;

-- 11. Verificar permissões do authenticator no novo schema
SELECT 
  nspname as schema_name,
  has_schema_privilege('authenticator', nspname, 'USAGE') as has_usage
FROM pg_namespace
WHERE nspname = 'sistemaretiradas';

