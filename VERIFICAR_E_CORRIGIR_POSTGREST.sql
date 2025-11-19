-- ============================================
-- SCRIPT PARA VERIFICAR E CORRIGIR POSTGREST
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. VERIFICAR se o schema sistemaretiradas existe
SELECT 
  schema_name,
  schema_owner
FROM information_schema.schemata
WHERE schema_name = 'sistemaretiradas';

-- 2. VERIFICAR se a tabela profiles existe no schema sistemaretiradas
SELECT 
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'sistemaretiradas' 
  AND table_name = 'profiles';

-- 3. VERIFICAR configuração atual do authenticator role
SELECT 
  rolname,
  rolconfig
FROM pg_roles
WHERE rolname = 'authenticator';

-- 4. VERIFICAR schemas expostos no PostgREST
-- (Isso mostra o valor atual de pgrst.db_schemas)
SELECT 
  rolname,
  rolconfig
FROM pg_roles
WHERE rolname = 'authenticator' 
  AND rolconfig IS NOT NULL
  AND 'pgrst.db_schemas' = ANY(ARRAY(SELECT unnest(rolconfig)::text));

-- 5. CONFIGURAR o authenticator role para expor os schemas corretos
-- IMPORTANTE: Isso substitui a configuração atual
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, sistemaretiradas, elevea';

-- 6. VERIFICAR permissões do schema sistemaretiradas
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'sistemaretiradas'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'authenticator')
LIMIT 20;

-- 7. GARANTIR permissões USAGE no schema
GRANT USAGE ON SCHEMA sistemaretiradas TO anon;
GRANT USAGE ON SCHEMA sistemaretiradas TO authenticated;
GRANT USAGE ON SCHEMA sistemaretiradas TO service_role;
GRANT USAGE ON SCHEMA sistemaretiradas TO authenticator;

-- 8. GARANTIR permissões SELECT/INSERT/UPDATE/DELETE nas tabelas
-- (Ajuste conforme necessário para suas tabelas)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sistemaretiradas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sistemaretiradas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sistemaretiradas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sistemaretiradas TO authenticator;

-- 9. GARANTIR permissões em sequências (para auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sistemaretiradas TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sistemaretiradas TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sistemaretiradas TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sistemaretiradas TO authenticator;

-- 10. CONFIGURAR permissões padrão para tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA sistemaretiradas
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role, authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA sistemaretiradas
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role, authenticator;

-- 11. FORÇAR o PostgREST a recarregar o cache de schemas
-- ⚠️ CRÍTICO: Isso faz o PostgREST reconhecer o schema sistemaretiradas
NOTIFY pgrst, 'reload schema';

-- 12. VERIFICAR novamente a configuração do authenticator
SELECT 
  rolname,
  rolconfig
FROM pg_roles
WHERE rolname = 'authenticator';

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- 1. Schema 'sistemaretiradas' deve existir
-- 2. Tabela 'profiles' deve existir em 'sistemaretiradas'
-- 3. authenticator.rolconfig deve conter 'pgrst.db_schemas=public, sistemaretiradas, elevea'
-- 4. Permissões devem estar concedidas para anon, authenticated, service_role, authenticator
-- 5. Após NOTIFY pgrst, o PostgREST deve reconhecer o schema
-- ============================================

