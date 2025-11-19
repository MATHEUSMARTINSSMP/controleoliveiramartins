-- ============================================
-- VERIFICAÇÃO COMPLETA DE PERMISSÕES
-- ============================================
-- Execute este script para verificar se todas as permissões estão corretas
-- ============================================

-- 1. Verificar permissões do service_role na tabela profiles (CRÍTICO)
SELECT 
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND table_name = 'profiles'
  AND grantee = 'service_role'
ORDER BY privilege_type;

-- 2. Verificar permissões de USAGE no schema
SELECT 
  nspname as schema_name,
  rolname as role_name,
  has_schema_privilege(rolname, nspname, 'USAGE') as has_usage
FROM pg_namespace
CROSS JOIN pg_roles
WHERE nspname = 'sacadaohboy-mrkitsch-loungerie'
  AND rolname = 'service_role';

-- 3. Verificar todas as permissões do service_role no schema
SELECT 
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) as all_privileges
FROM information_schema.table_privileges
WHERE table_schema = 'sacadaohboy-mrkitsch-loungerie'
  AND grantee = 'service_role'
GROUP BY table_schema, table_name, grantee
ORDER BY table_name;

-- 4. Teste prático: tentar acessar a tabela profiles
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN email = 'matheusmartinss@icloud.com' THEN 1 END) as found_user
FROM "sacadaohboy-mrkitsch-loungerie".profiles;

